import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { Questionnaire, QuestionnaireDocument } from 'src/questionnaires/schemas/questionnaire.schema';
import {
  QuestionnaireResponse,
  QuestionnaireResponseDocument,
} from 'src/questionnaires/schemas/questionnaire-response.schema';
import { Role, RoleDocument } from 'src/role/schemas/role.schema';
import { Symptom, SymptomDocument } from 'src/symptoms/schemas/symptom.schema';
import {
  SymptomResponse,
  SymptomResponseDocument,
} from 'src/symptoms/schemas/symptom-response.schema';
import { User, UserDocument } from 'src/users/users.schema';

type AuthUserPayload = { sub?: string; userId?: string };

type LeanPatient = {
  _id: { toString(): string };
  firstName?: string;
  lastName?: string;
  email?: string;
  assignedDepartment?: string;
  role?: unknown;
};

type CoordinatorContext = {
  user: UserDocument;
  department: string | null;
};

type ProtocolStatus = 'completed' | 'pending' | 'not_assigned';

type ProtocolStep = {
  status: ProtocolStatus;
  completed: boolean;
  expectedCount: number;
  completedCount: number;
  latestSubmissionAt: Date | null;
};

type FollowUpProtocolItem = {
  patientId: string;
  patientName: string;
  patientEmail: string;
  assignedDepartment: string;
  questionnaire: ProtocolStep;
  symptoms: ProtocolStep;
  vitalSigns: ProtocolStep;
  coordinatorValidation: {
    status: ProtocolStatus;
    completed: boolean;
    latestValidatedAt: Date | null;
    latestValidatedBy: string | null;
  };
  latestActivityAt: Date | null;
};

@Injectable()
export class CoordinatorService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Role.name)
    private readonly roleModel: Model<RoleDocument>,
    @InjectModel(Questionnaire.name)
    private readonly questionnaireModel: Model<QuestionnaireDocument>,
    @InjectModel(QuestionnaireResponse.name)
    private readonly questionnaireResponseModel: Model<QuestionnaireResponseDocument>,
    @InjectModel(Symptom.name)
    private readonly symptomModel: Model<SymptomDocument>,
    @InjectModel(SymptomResponse.name)
    private readonly symptomResponseModel: Model<SymptomResponseDocument>,
  ) {}

  async getDashboard(authUser: AuthUserPayload, range?: string) {
    const coordinator = await this.getCoordinatorContext(authUser);
    const protocol = await this.buildFollowUpProtocol(coordinator);
    const days = this.resolveRange(range);
    const since = this.getSince(days);
    const scopedPatients = protocol.length;

    const [
      totalPatients,
      validatedSymptoms,
      pendingValidation,
      questionnaireActivity,
      symptomActivity,
      validationActivity,
    ] = await Promise.all([
      this.userModel.countDocuments({ actif: true }).exec(),
      this.countValidatedSymptoms(coordinator.department),
      this.countPendingSymptoms(coordinator.department),
      this.aggregateQuestionnaireActivity(coordinator.department, since),
      this.aggregateSymptomActivity(coordinator.department, since),
      this.aggregateValidationActivity(coordinator.department, since),
    ]);

    return {
      scope: {
        department: coordinator.department,
        patientsInScope: scopedPatients,
        globalPatients: totalPatients,
      },
      statistics: {
        completedQuestionnaires: protocol.filter((item) => item.questionnaire.completed).length,
        submittedSymptoms: protocol.filter((item) => item.symptoms.completed).length,
        submittedVitalSigns: protocol.filter((item) => item.vitalSigns.completed).length,
        validatedSymptoms,
        pendingValidation,
      },
      rates: {
        questionnaireCompletionRate: this.toRate(
          protocol.filter((item) => item.questionnaire.completed).length,
          scopedPatients,
        ),
        symptomSubmissionRate: this.toRate(
          protocol.filter((item) => item.symptoms.completed).length,
          scopedPatients,
        ),
        vitalSignsSubmissionRate: this.toRate(
          protocol.filter((item) => item.vitalSigns.completed).length,
          scopedPatients,
        ),
      },
      charts: {
        questionnaires: questionnaireActivity,
        symptoms: symptomActivity,
        generalActivity: validationActivity,
      },
    };
  }

  async getFollowUpProtocol(authUser: AuthUserPayload): Promise<FollowUpProtocolItem[]> {
    const coordinator = await this.getCoordinatorContext(authUser);
    return this.buildFollowUpProtocol(coordinator);
  }

  async getPatientFollowUpProtocol(
    authUser: AuthUserPayload,
    patientId: string,
  ): Promise<FollowUpProtocolItem> {
    if (!patientId || !isValidObjectId(patientId)) {
      throw new BadRequestException('Invalid patient id');
    }

    const coordinator = await this.getCoordinatorContext(authUser);
    const protocol = await this.buildFollowUpProtocol(coordinator);
    const item = protocol.find((entry) => entry.patientId === patientId);

    if (!item) {
      throw new NotFoundException(`Patient ${patientId} not found in coordinator scope`);
    }

    return item;
  }

  private async buildFollowUpProtocol(
    coordinator: CoordinatorContext,
  ): Promise<FollowUpProtocolItem[]> {
    const patients = await this.getScopedPatients(coordinator.department);
    if (patients.length === 0) {
      return [];
    }

    const patientIds = patients.map((patient) => patient._id.toString());
    const patientDepartments = [...new Set(patients.map((patient) => patient.assignedDepartment).filter(Boolean))];

    const [questionnaires, questionnaireResponses, symptomForms, symptomResponses] = await Promise.all([
      this.questionnaireModel
        .find({
          status: 'active',
          ...(patientDepartments.length > 0 ? { medicalService: { $in: patientDepartments } } : {}),
        })
        .lean()
        .exec(),
      this.questionnaireResponseModel
        .find({ patientId: { $in: patientIds } })
        .select('questionnaireId patientId createdAt')
        .lean()
        .exec(),
      this.symptomModel
        .find({
          isActive: true,
          $or: [{ patientIds: { $in: patientIds } }, { patientId: { $in: patientIds } }],
        })
        .lean()
        .exec(),
      this.symptomResponseModel
        .find({ patientId: { $in: patientIds } })
        .select('patientId symptomFormId vitals validated validatedAt validatedByName createdAt')
        .lean()
        .exec(),
    ]);

    const questionnairesByDepartment = new Map<string, string[]>();
    for (const questionnaire of questionnaires) {
      const key = this.normalizeDepartment(questionnaire.medicalService);
      const ids = questionnairesByDepartment.get(key) ?? [];
      ids.push(questionnaire._id.toString());
      questionnairesByDepartment.set(key, ids);
    }

    const symptomFormsByPatient = new Map<string, string[]>();
    for (const form of symptomForms) {
      const targets = this.extractPatientIdsFromForm(form);
      for (const patientId of targets) {
        if (!patientIds.includes(patientId)) {
          continue;
        }
        const ids = symptomFormsByPatient.get(patientId) ?? [];
        ids.push(form._id.toString());
        symptomFormsByPatient.set(patientId, ids);
      }
    }

    const questionnaireResponsesByPatient = new Map<string, Array<{ questionnaireId: string; createdAt: Date | null }>>();
    for (const response of questionnaireResponses) {
      const key = response.patientId?.toString?.();
      if (!key) {
        continue;
      }
      const items = questionnaireResponsesByPatient.get(key) ?? [];
      items.push({
        questionnaireId: response.questionnaireId?.toString?.() ?? '',
        createdAt: (response as QuestionnaireResponseDocument & { createdAt?: Date }).createdAt ?? null,
      });
      questionnaireResponsesByPatient.set(key, items);
    }

    const symptomResponsesByPatient = new Map<
      string,
      Array<{
        symptomFormId: string;
        createdAt: Date | null;
        validated: boolean;
        validatedAt: Date | null;
        validatedByName: string | null;
        hasVitals: boolean;
      }>
    >();
    for (const response of symptomResponses) {
      const key = response.patientId?.toString?.() ?? '';
      if (!key) {
        continue;
      }
      const items = symptomResponsesByPatient.get(key) ?? [];
      items.push({
        symptomFormId: response.symptomFormId?.toString?.() ?? '',
        createdAt: response.createdAt ?? null,
        validated: response.validated ?? false,
        validatedAt: response.validatedAt ?? null,
        validatedByName: response.validatedByName ?? null,
        hasVitals: this.hasSubmittedVitals(response.vitals),
      });
      symptomResponsesByPatient.set(key, items);
    }

    return patients
      .map((patient) => {
        const patientId = patient._id.toString();
        const departmentKey = this.normalizeDepartment(patient.assignedDepartment);
        const expectedQuestionnaires = questionnairesByDepartment.get(departmentKey) ?? [];
        const patientQuestionnaireResponses = questionnaireResponsesByPatient.get(patientId) ?? [];
        const completedQuestionnaires = new Set(
          patientQuestionnaireResponses
            .filter((response) => expectedQuestionnaires.includes(response.questionnaireId))
            .map((response) => response.questionnaireId),
        );

        const expectedSymptoms = symptomFormsByPatient.get(patientId) ?? [];
        const patientSymptomResponses = symptomResponsesByPatient.get(patientId) ?? [];
        const matchingSymptomResponses = patientSymptomResponses.filter((response) =>
          expectedSymptoms.includes(response.symptomFormId),
        );

        const questionnaireStep = this.buildProtocolStep(
          expectedQuestionnaires.length,
          completedQuestionnaires.size,
          this.getLatestDate(patientQuestionnaireResponses.map((response) => response.createdAt)),
        );
        const symptomsStep = this.buildProtocolStep(
          expectedSymptoms.length,
          matchingSymptomResponses.length > 0 ? 1 : 0,
          this.getLatestDate(matchingSymptomResponses.map((response) => response.createdAt)),
        );
        const vitalSignsStep = this.buildProtocolStep(
          expectedSymptoms.length,
          matchingSymptomResponses.some((response) => response.hasVitals) ? 1 : 0,
          this.getLatestDate(
            matchingSymptomResponses.filter((response) => response.hasVitals).map((response) => response.createdAt),
          ),
        );

        const latestValidated = matchingSymptomResponses
          .filter((response) => response.validated)
          .sort((left, right) => this.dateValue(right.validatedAt) - this.dateValue(left.validatedAt))[0];

        const validationStatus: ProtocolStatus =
          expectedSymptoms.length === 0
            ? 'not_assigned'
            : latestValidated
              ? 'completed'
              : 'pending';

        return {
          patientId,
          patientName: this.buildUserDisplayName(patient),
          patientEmail: patient.email ?? '',
          assignedDepartment: patient.assignedDepartment ?? '',
          questionnaire: questionnaireStep,
          symptoms: symptomsStep,
          vitalSigns: vitalSignsStep,
          coordinatorValidation: {
            status: validationStatus,
            completed: Boolean(latestValidated),
            latestValidatedAt: latestValidated?.validatedAt ?? null,
            latestValidatedBy: latestValidated?.validatedByName ?? null,
          },
          latestActivityAt: this.getLatestDate([
            questionnaireStep.latestSubmissionAt,
            symptomsStep.latestSubmissionAt,
            vitalSignsStep.latestSubmissionAt,
          ]),
        };
      })
      .sort((left, right) => this.dateValue(right.latestActivityAt) - this.dateValue(left.latestActivityAt));
  }

  private async getCoordinatorContext(authUser: AuthUserPayload): Promise<CoordinatorContext> {
    const authUserId = authUser?.sub ?? authUser?.userId ?? '';
    if (!authUserId || !isValidObjectId(authUserId)) {
      throw new ForbiddenException('Invalid authenticated user');
    }

    const user = await this.userModel.findById(authUserId).exec();
    if (!user) {
      throw new NotFoundException('Authenticated user not found');
    }

    const roleName = await this.resolveRoleName(user.role);
    if (roleName !== 'coordinator') {
      throw new ForbiddenException('Coordinator access is required');
    }

    return {
      user,
      department: user.assignedDepartment?.trim() ?? null,
    };
  }

  private async getScopedPatients(department: string | null): Promise<LeanPatient[]> {
    const users = await this.userModel
      .find({
        actif: true,
        ...(department
          ? {
              assignedDepartment: {
                $regex: `^${this.escapeRegex(department)}$`,
                $options: 'i',
              },
            }
          : {}),
      })
      .select('_id firstName lastName email assignedDepartment role')
      .lean()
      .exec();

    const roleMap = await this.buildRoleMap(users);

    return users.filter((user) => this.resolveRoleNameFromValue(user.role, roleMap) === 'patient');
  }

  private async buildRoleMap(users: LeanPatient[]): Promise<Map<string, string>> {
    const roleIds = users
      .map((user) => (typeof user.role === 'string' && isValidObjectId(user.role) ? user.role : null))
      .filter((value): value is string => Boolean(value));

    if (roleIds.length === 0) {
      return new Map();
    }

    const roles = await this.roleModel.find({ _id: { $in: [...new Set(roleIds)] } }).select('name').lean().exec();
    return new Map(roles.map((role) => [role._id.toString(), role.name.trim().toLowerCase()]));
  }

  private resolveRoleNameFromValue(roleValue: unknown, roleMap: Map<string, string>): string {
    if (roleValue && typeof roleValue === 'object' && 'name' in roleValue) {
      const roleName = (roleValue as { name?: string }).name;
      return roleName?.trim().toLowerCase() ?? '';
    }

    if (typeof roleValue === 'string') {
      if (isValidObjectId(roleValue)) {
        return roleMap.get(roleValue) ?? '';
      }

      return roleValue.trim().toLowerCase();
    }

    return '';
  }

  private async resolveRoleName(roleValue: unknown): Promise<string> {
    if (roleValue && typeof roleValue === 'object' && 'name' in roleValue) {
      const roleName = (roleValue as { name?: string }).name;
      return roleName?.trim().toLowerCase() ?? '';
    }

    if (typeof roleValue === 'string' && isValidObjectId(roleValue)) {
      const role = await this.roleModel.findById(roleValue).select('name').lean().exec();
      return role?.name?.trim().toLowerCase() ?? '';
    }

    if (typeof roleValue === 'string') {
      return roleValue.trim().toLowerCase();
    }

    return '';
  }

  private buildProtocolStep(
    expectedCount: number,
    completedCount: number,
    latestSubmissionAt: Date | null,
  ): ProtocolStep {
    if (expectedCount === 0) {
      return {
        status: 'not_assigned',
        completed: false,
        expectedCount,
        completedCount,
        latestSubmissionAt,
      };
    }

    const completed = completedCount > 0;

    return {
      status: completed ? 'completed' : 'pending',
      completed,
      expectedCount,
      completedCount,
      latestSubmissionAt,
    };
  }

  private async countValidatedSymptoms(department: string | null): Promise<number> {
    const patientIds = await this.getScopedPatientIds(department);
    if (patientIds.length === 0) {
      return 0;
    }

    return this.symptomResponseModel.countDocuments({
      patientId: { $in: patientIds },
      validated: true,
    });
  }

  private async countPendingSymptoms(department: string | null): Promise<number> {
    const patientIds = await this.getScopedPatientIds(department);
    if (patientIds.length === 0) {
      return 0;
    }

    return this.symptomResponseModel.countDocuments({
      patientId: { $in: patientIds },
      validated: false,
    });
  }

  private async getScopedPatientIds(department: string | null): Promise<string[]> {
    const patients = await this.getScopedPatients(department);
    return patients.map((patient) => patient._id.toString());
  }

  private async aggregateQuestionnaireActivity(department: string | null, since: Date) {
    const patients = await this.getScopedPatients(department);
    const patientIds = patients.map((patient) => patient._id);
    if (patientIds.length === 0) {
      return [];
    }

    return this.questionnaireResponseModel
      .aggregate([
        {
          $match: {
            patientId: { $in: patientIds },
            createdAt: { $gte: since },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            completedQuestionnaires: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            date: '$_id',
            completedQuestionnaires: 1,
          },
        },
      ])
      .exec();
  }

  private async aggregateSymptomActivity(department: string | null, since: Date) {
    const patientIds = await this.getScopedPatientIds(department);
    if (patientIds.length === 0) {
      return [];
    }

    return this.symptomResponseModel
      .aggregate([
        {
          $match: {
            patientId: { $in: patientIds },
            createdAt: { $gte: since },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            submittedSymptoms: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            date: '$_id',
            submittedSymptoms: 1,
          },
        },
      ])
      .exec();
  }

  private async aggregateValidationActivity(department: string | null, since: Date) {
    const patientIds = await this.getScopedPatientIds(department);
    if (patientIds.length === 0) {
      return [];
    }

    return this.symptomResponseModel
      .aggregate([
        {
          $match: {
            patientId: { $in: patientIds },
            createdAt: { $gte: since },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            generalActivity: { $sum: 1 },
            validatedSymptoms: {
              $sum: {
                $cond: [{ $eq: ['$validated', true] }, 1, 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            date: '$_id',
            generalActivity: 1,
            validatedSymptoms: 1,
          },
        },
      ])
      .exec();
  }

  private extractPatientIdsFromForm(form: Partial<Symptom>): string[] {
    const patientIds = [
      ...(Array.isArray(form.patientIds) ? form.patientIds : []),
      ...(typeof form.patientId === 'string' && form.patientId.trim() ? [form.patientId.trim()] : []),
    ];

    return [...new Set(patientIds)];
  }

  private hasSubmittedVitals(vitals: SymptomResponse['vitals'] | undefined): boolean {
    if (!vitals) {
      return false;
    }

    return [
      vitals.bloodPressure,
      vitals.heartRate,
      vitals.temperature,
      vitals.weight,
    ].some((value) => value !== null && value !== undefined && value !== '');
  }

  private buildUserDisplayName(user: Pick<LeanPatient, 'firstName' | 'lastName' | 'email'>): string {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return fullName || user.email || 'Unknown patient';
  }

  private normalizeDepartment(department: string | null | undefined): string {
    return (department ?? '').trim().toLowerCase();
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private getLatestDate(dates: Array<Date | null | undefined>): Date | null {
    const validDates = dates.filter((value): value is Date => value instanceof Date);
    if (validDates.length === 0) {
      return null;
    }

    return validDates.sort((left, right) => right.getTime() - left.getTime())[0];
  }

  private dateValue(value: Date | null | undefined): number {
    return value instanceof Date ? value.getTime() : 0;
  }

  private resolveRange(range?: string): number {
    switch ((range ?? '7d').trim()) {
      case '30d':
        return 30;
      case '90d':
        return 90;
      default:
        return 7;
    }
  }

  private getSince(days: number): Date {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return since;
  }

  private toRate(value: number, total: number): number {
    if (total <= 0) {
      return 0;
    }

    return Math.round((value / total) * 100);
  }
}
