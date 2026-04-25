import { SuggestionsService } from './autocomplete/suggestions.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import Groq from 'groq-sdk';
import { CreateSymptomDto } from './dto/create-symptom.dto';
import { Symptom, SymptomDocument } from './schemas/symptom.schema';
import { SymptomResponse, SymptomResponseDocument } from './schemas/symptom-response.schema';
import { SubmitResponseDto } from './dto/submit-response.dto';
import { GenerateSymptomDto } from './dto/generate-symptom.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateSymptomDto } from './dto/update-symptom.dto';
import { Question, QuestionCategory, QuestionType } from './schemas/question.schema';
import { ResponseActionDto } from './dto/response-action.dto';
import { User, UserDocument } from 'src/users/users.schema';
import { Role, RoleDocument } from 'src/role/schemas/role.schema';
import { AlertsService } from 'src/alert/alerts.service';
import { AnalysisService } from 'src/ai-analysis/analysis.service';
import { SuggestionsGateway } from './autocomplete/suggestions.gateway';
import { NotificationsService } from 'src/notifications/notifications.service';

// ── Mapping: medical service → clinical focus areas ──────────────────────────
//
// Each entry lists the concrete vitals, observations and actions that are
// clinically relevant for that department.  The AI prompt injects these hints
// so that it generates questions specific to the service rather than generic
// symptom follow-up questions.
//
const SERVICE_CLINICAL_HINTS: Record<string, string> = {
  Cardiology: `
  Focus on: heart rate (bpm), blood pressure (mmHg), oxygen saturation (SpO2 %),
  chest pain (location, radiation, intensity 1-10), palpitations, shortness of breath
  at rest vs effort, ankle/leg oedema, syncope episodes, nitrate intake, weight change
  (cardiac fluid retention indicator).`,

  Neurology: `
  Focus on: headache (location, intensity 1-10, pulsating vs pressure), dizziness /
  vertigo, visual disturbances, speech difficulties, limb weakness or numbness,
  coordination problems, seizure frequency, memory lapses, sleep quality, medication
  adherence (anticonvulsants, etc.).`,

  Pediatrics: `
  Focus on: body temperature (°C), feeding / appetite (breast, bottle, solids),
  hydration status (number of wet nappies / urination), stool consistency and colour,
  vomiting episodes, rash presence and location, crying pattern, sleep hours,
  vaccination reactions, caregiver concern level.`,

  Oncology: `
  Focus on: pain level (1-10, location), fatigue severity, nausea/vomiting frequency,
  appetite and weight loss, mucositis / mouth sores, hair loss distress, chemotherapy
  side-effects (numbness, tingling), dressing / port-site condition (clean, red,
  oozing), emotional wellbeing.`,

  'General Medicine': `
  Focus on: body temperature (°C), heart rate, blood pressure, general pain level
  (1-10), fatigue, cough (dry/productive), appetite, bowel movements, urination
  frequency, recent medication changes, wound or dressing condition if applicable.`,

  Orthopedics: `
  Focus on: wound / surgical site condition (clean, redness, swelling, discharge),
  dressing change performed (yes/no) and date, pain level at rest and during movement
  (1-10), joint range of motion, weight-bearing ability, physiotherapy exercises
  compliance, cast or brace integrity, limb swelling or colour change.`,

  Dermatology: `
  Focus on: lesion / rash extent and location, colour changes, itching intensity
  (1-10), oozing or crusting, dressing change (done/not done), topical treatment
  applied (yes/no), sun exposure, new lesions appeared, allergic reaction signs,
  skin dryness or peeling.`,

  Psychiatry: `
  Focus on: mood rating (1-10), sleep quality and hours, appetite, suicidal ideation
  (safe screening), anxiety level (1-10), medication taken as prescribed (yes/no),
  social interaction, concentration ability, substance use, recent stressful events,
  hallucination or delusion episodes.`,

  Radiology: `
  Focus on: contrast reaction symptoms (nausea, rash, dyspnea) after imaging,
  injection site condition (pain, bruising, swelling), pain level post-procedure
  (1-10), hydration intake post-contrast, ability to void normally, any new
  neurological symptoms post-myelogram if applicable.`,

  Surgery: `
  Focus on: surgical wound condition (clean, red, swollen, discharge colour/amount),
  dressing change performed (yes/no) and last date, pain level at rest and on
  movement (1-10), body temperature (fever watch), nausea/vomiting post-op,
  bowel sounds / first flatus or bowel movement, drain output if present (volume,
  colour), mobilisation level, ability to eat and drink.`,
};

// ── Default hints used when no specific service match is found ────────────────
const DEFAULT_CLINICAL_HINTS = `
  Focus on: body temperature (°C), heart rate, pain level (1-10), fatigue,
  wound / dressing condition, appetite, hydration, medication adherence.`;

type FrontendQuestionType =
  | 'text'
  | 'number'
  | 'rating'
  | 'yes/no'
  | 'single choice'
  | 'multiple choice'
  | 'select'
  | 'date';

type FrontendGeneratedQuestion = {
  label: string;
  type: FrontendQuestionType;
  options: string[];
  category?: string;
};

const FRONTEND_QUESTION_TYPES: FrontendQuestionType[] = [
  'text',
  'number',
  'rating',
  'yes/no',
  'single choice',
  'multiple choice',
  'select',
  'date',
];

type SymptomResponseByDateItem = {
  formId: Symptom | Types.ObjectId | string;
  answers: Array<{
    question: string;
    answer: string | number | boolean | string[] | null;
  }>;
  createdAt: Date;
};

type SymptomVitalsView = {
  bloodPressure: string | null;
  heartRate: number | null;
  temperature: number | null;
  weight: number | null;
};

type NurseVisibleResponseItem = {
  _id: string;
  patientId: string;
  patientName: string;
  patientDepartment: string;
  patientEmail: string;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date | null;
  vitals: SymptomVitalsView;
  answers: Array<{
    question: string;
    answer: string | number | boolean | string[] | null;
  }>;
  validated: boolean;
  validatedBy: string | null;
  validatedByName: string | null;
  validatedByRole: string | null;
  validatedAt: Date | null;
  validationNote: string;
  issueReported: boolean;
};

type AuthUserPayload = { sub?: string; userId?: string };

type ScopedStaffUser = {
  user: UserDocument;
  roleName: string;
  department: string | null;
};

type NormalizedSymptomAnswer = {
  questionId: string;
  value: string | number | boolean | string[] | null;
};

type TodayQuestionStatus = {
  questionId: string;
  questionText: string;
  required: boolean;
  remainingRequired: number;
  remainingOptional: number;
  isBlocked: boolean;
};

type PatientAssignmentStatus = {
  _id: string;
  name: string;
  isAssigned: boolean;
};

@Injectable()
export class SymptomsService {
  private readonly logger = new Logger(SymptomsService.name);
  private client = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  constructor(
    @InjectModel(Symptom.name)
    private symptomModel: Model<SymptomDocument>,
    @InjectModel(SymptomResponse.name)
    private symptomResponseModel: Model<SymptomResponseDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(Role.name)
    private roleModel: Model<RoleDocument>,
    private readonly alertsService: AlertsService,   // ← Injection du service d'alertes
    private readonly analysisService: AnalysisService, // ← Injection du service d'analyse AI
 private readonly suggestionsService: SuggestionsService,
    private readonly suggestionsGateway: SuggestionsGateway,
    private readonly notificationsService: NotificationsService, // ← Injection du service de notifications
  ) {}

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async create(dto: CreateSymptomDto): Promise<Record<string, unknown>> {
    console.log(dto);

    const title = dto.title?.trim();
    if (!title) {
      throw new BadRequestException('title must not be empty');
    }

    const patientIds = this.normalizePatientIds(dto.patientIds, dto.patientId);
    const questions = this.normalizeQuestions(dto.questions ?? []);
    const status = this.normalizeStatus(dto.status, dto.isActive);
    const isActive = status === 'active';
    const startDate = this.normalizeDate(dto.startDate ? new Date(dto.startDate) : new Date());
    const durationInDays = this.normalizeDurationInDays(dto.durationInDays ?? 7);
    const endDate = this.calculateEndDate(startDate, durationInDays);

    if (isActive) {
      await this.symptomModel
        .updateMany(
          {
            isActive: true,
            $or: [
              { patientIds: { $in: patientIds } },
              { patientId: { $in: patientIds } },
            ],
          },
          { $set: { isActive: false, status: 'inactive' } },
        )
        .exec();
    }

    const symptom = await this.symptomModel.create({
      title,
      description: dto.description?.trim() ?? '',
      medicalService: dto.medicalService?.trim() ?? '',
      durationInDays,
      startDate,
      endDate,
      patientIds,
      patientId: patientIds[0],
      questions,
      isActive,
      status,
    });

    return this.serializeSymptomForm(symptom);
  }

  async findAll(): Promise<Record<string, unknown>[]> {
    const symptoms = await this.symptomModel.find().sort({ createdAt: -1 }).exec();
    return symptoms.map((symptom) => this.serializeSymptomForm(symptom));
  }

  async getPatientsWithAssignmentStatus(): Promise<PatientAssignmentStatus[]> {
    const [patients, activeSymptoms] = await Promise.all([
      this.findPatientUsers(),
      this.symptomModel
        .find({ isActive: true })
        .select('patientIds patientId')
        .lean()
        .exec(),
    ]);

    const assignedPatientIds = activeSymptoms.flatMap((symptom) =>
      this.normalizeExistingPatientIds(symptom.patientIds, symptom.patientId),
    );

    return patients.map((patient) => {
      const patientId = patient._id.toString();

      return {
        _id: patientId,
        name: this.buildUserDisplayName(patient),
        isAssigned: this.isPatientAssigned(patientId, assignedPatientIds),
      };
    });
  }

  async findById(id: string): Promise<Record<string, unknown>> {
    if (!id || !isValidObjectId(id)) {
      throw new BadRequestException('Invalid symptom form id');
    }

    const symptom = await this.symptomModel.findById(id).exec();
    if (!symptom) {
      throw new NotFoundException(`Symptom form ${id} not found`);
    }

    return this.serializeSymptomForm(symptom);
  }

  async getLatestActive(): Promise<Record<string, unknown>> {
    const symptom = await this.symptomModel
      .findOne({ isActive: true })
      .sort({ createdAt: -1 })
      .exec();

    if (!symptom) {
      throw new NotFoundException('No active symptom form found');
    }

    return this.serializeSymptomForm(symptom);
  }

  async findFormByPatient(patientId: string): Promise<Record<string, unknown>> {
    const normalizedPatientId = patientId?.trim();

    if (!normalizedPatientId) {
      throw new BadRequestException('Invalid patientId');
    }

    const symptom = await this.symptomModel
      .findOne({
        $or: [
          { patientIds: normalizedPatientId },
          { patientId: normalizedPatientId },
        ],
        isActive: true,
      })
      .sort({ createdAt: -1, _id: -1 })
      .exec();

    if (!symptom) {
      throw new NotFoundException(`No active symptom form found for patient ${normalizedPatientId}`);
    }

    return this.serializeSymptomForm(symptom);
  }

  async update(id: string, dto: UpdateSymptomDto): Promise<Record<string, unknown>> {
    if (!id || !isValidObjectId(id)) {
      throw new BadRequestException('Invalid symptom form id');
    }

    const existing = await this.symptomModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException(`Symptom form ${id} not found`);
    }

    const updateData: Partial<Symptom> = {};

    if (typeof dto.title === 'string') {
      const title = dto.title.trim();
      if (!title) throw new BadRequestException('title must not be empty');
      updateData.title = title;
    }

    if (typeof dto.description === 'string') {
      updateData.description = dto.description.trim();
    }

    if (typeof dto.medicalService === 'string') {
      updateData.medicalService = dto.medicalService.trim();
    }

    if (dto.durationInDays !== undefined) {
      updateData.durationInDays = this.normalizeDurationInDays(dto.durationInDays);
    }

    if (dto.startDate !== undefined) {
      updateData.startDate = this.normalizeDate(new Date(dto.startDate));
    }

    if (dto.patientIds !== undefined || dto.patientId !== undefined) {
      const patientIds = this.normalizePatientIds(dto.patientIds, dto.patientId);
      updateData.patientIds = patientIds;
      updateData.patientId = patientIds[0];
    }

    if (dto.questions !== undefined) {
      updateData.questions = this.normalizeQuestions(dto.questions);
    }

    const nextStatus = this.resolveNextStatus(dto, existing);
    if (nextStatus !== null) {
      updateData.status = nextStatus;
      updateData.isActive = nextStatus === 'active';
    }

    if (updateData.isActive) {
      const patientIdsForDeactivation =
        updateData.patientIds ??
        this.getSymptomPatientIds(existing);

      await this.symptomModel
        .updateMany(
          {
            _id: { $ne: id },
            isActive: true,
            $or: [
              { patientIds: { $in: patientIdsForDeactivation } },
              { patientId: { $in: patientIdsForDeactivation } },
            ],
          },
          { $set: { isActive: false, status: 'inactive' } },
        )
        .exec();
    }

    if (updateData.startDate !== undefined || updateData.durationInDays !== undefined) {
      const nextStartDate = updateData.startDate ?? this.normalizeDate(new Date(existing.startDate ?? new Date()));
      const nextDurationInDays = updateData.durationInDays ?? this.normalizeDurationInDays(existing.durationInDays ?? 7);
      updateData.endDate = this.calculateEndDate(nextStartDate, nextDurationInDays);
    }

    const updated = await this.symptomModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();

    if (!updated) throw new NotFoundException(`Symptom form ${id} not found`);

    return this.serializeSymptomForm(updated);
  }

  async remove(id: string): Promise<void> {
    if (!id || !isValidObjectId(id)) {
      throw new BadRequestException('Invalid symptom form id');
    }

    const deleted = await this.symptomModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException(`Symptom form ${id} not found`);
  }

  async saveResponse(dto: SubmitResponseDto): Promise<SymptomResponse> {
   console.log('🔥 [SYMPTOMS SERVICE] saveResponse appelée !');
  console.log('📥 DTO reçu:', JSON.stringify(dto, null, 2));
   
    if (!dto.formId || !isValidObjectId(dto.formId)) {
      throw new BadRequestException('Invalid formId');
    }

    const normalizedPatientId = typeof dto.patientId === 'string' ? dto.patientId.trim() : '';
    console.log(`👤 Patient ID normalisé: ${normalizedPatientId || 'AUCUN'}`);
    if (dto.patientId && !normalizedPatientId) {
      throw new BadRequestException('Invalid patientId');
    }

    const symptomForm = await this.symptomModel
      .findById(dto.formId)
      .exec();

     

    if (!symptomForm) {
      throw new NotFoundException(`Symptom form ${dto.formId} not found`);
    }

    const today = this.normalizeDate(new Date());
    const effectiveStartDate = this.normalizeDate(
      new Date(symptomForm.startDate ?? new Date()),
    );
    const effectiveDurationInDays = this.normalizeDurationInDays(
      symptomForm.durationInDays ?? 7,
    );
    const effectiveEndDate = symptomForm.endDate
      ? this.normalizeDate(new Date(symptomForm.endDate))
      : this.calculateEndDate(effectiveStartDate, effectiveDurationInDays);

    if (today > effectiveEndDate) {
      throw new BadRequestException('Form expired. You can no longer submit symptoms.');
    }

    if (!Array.isArray(dto.answers) || dto.answers.length === 0) {
      throw new BadRequestException('answers must be a non-empty array');
    }
   

    const responseDate = this.normalizeDate(dto.date ? new Date(dto.date) : new Date());

    const questionById = new Map(
      symptomForm.questions
        .map((question) => {
          const questionId = (question as Question & { _id?: Types.ObjectId })._id;
          return questionId ? [questionId.toString(), question] as const : null;
        })
        .filter((entry): entry is readonly [string, Question] => entry !== null),
    );

    const submittedQuestionIds = new Set<string>();
    const normalizedAnswers: NormalizedSymptomAnswer[] = dto.answers.map((answer, index) => {
      if (!answer?.questionId || !isValidObjectId(answer.questionId)) {
        throw new BadRequestException(`Answer ${index + 1}: invalid questionId`);
      }

      if (!questionById.has(answer.questionId)) {
        throw new BadRequestException(
          `Answer ${index + 1}: questionId does not belong to form ${dto.formId}`,
        );
      }

      if (submittedQuestionIds.has(answer.questionId)) {
        throw new BadRequestException(
          `Answer ${index + 1}: duplicate questionId in the same submission`,
        );
      }
      submittedQuestionIds.add(answer.questionId);

      return {
        questionId: answer.questionId,
        value: answer.value ?? null,
      };
    });

    if (normalizedPatientId) {
      await this.validateDailyQuestionSubmissions(
        normalizedPatientId,
        symptomForm,
        normalizedAnswers,
        questionById,
      );
    }

    const response = new this.symptomResponseModel({
      symptomFormId: this.getSymptomDocumentObjectId(symptomForm),
      ...(normalizedPatientId ? { patientId: normalizedPatientId } : {}),
      answers: normalizedAnswers,
      date: responseDate,
      vitals: this.extractVitals(symptomForm, normalizedAnswers),
      validated: false,
      validatedBy: null,
      validatedByName: null,
      validatedByRole: null,
      validatedAt: null,
      validationNote: '',
      issueReported: false,
    });
    await response.save(); //j'ai ajouté ca pour alerte
console.log(`✅ Réponse sauvegardée avec succès. ID: ${response._id}`);

    // === NOUVELLE PARTIE : VÉRIFICATION D'ALERTE IA ===
   if (normalizedPatientId) {
      console.log(`🔍 [ALERTE] Soumission détectée pour patient: ${normalizedPatientId}`);

       // ── Récupérer le doctorId du patient ──────────────────
  let doctorId: string | undefined = dto.assignedDoctorId;

  if (!doctorId) {
    try {
      const patient = await this.userModel.findById(normalizedPatientId)
        .select('primaryDoctor')
        .lean()
        .exec();

      if (patient?.primaryDoctor) {
        // primaryDoctor est un nom "Dr. Ahmed Ben Ali" → chercher par nom
        const doctorName = String(patient.primaryDoctor).trim();
        
        // Essayer de trouver par firstName + lastName
        const nameParts = doctorName.replace(/^Dr\.?\s*/i, '').trim().split(' ');
        const firstName = nameParts[0];
        const lastName  = nameParts.slice(1).join(' ');

        const doctor = await this.userModel.findOne({
          $or: [
            { firstName, lastName },
            { firstName: { $regex: `^${firstName}$`, $options: 'i' },
              lastName:  { $regex: `^${lastName}$`,  $options: 'i' } },
          ]
        }).select('_id').lean().exec();

        if (doctor) {
          doctorId = String(doctor._id);
          console.log(`👨‍⚕️ Médecin trouvé: ${doctorName} → ID: ${doctorId}`);
        } else {
          console.warn(`⚠️ Médecin "${doctorName}" non trouvé en base`);
        }
      }
    } catch (err) {
      console.error('Erreur récupération médecin:', err.message);
    }
  }

     // ← passer questionMap ici
     
      // ── Extraire les vitaux ────────────────────────────────
  const questionMap = new Map(
    symptomForm.questions.map((q: any) => [
      q._id?.toString(),
      {
        label: q.label || '',
        category: q.category || null,
      },
    ])
  );
  const vitalsForAlert = this.extractVitalsForAlert(normalizedAnswers, questionMap);
  console.log(`📊 Vitals envoyés à FastAPI:`, vitalsForAlert);

  const alertResult = await this.alertsService.checkAndCreateAlert(
    normalizedPatientId,
    response._id.toString(),
    vitalsForAlert,
    doctorId, 
  );

  if (alertResult) {
    console.log(`✅ Alerte créée ! Severity: ${alertResult.severity}`);
  } else {
    console.log(`ℹ️ Aucune alerte déclenchée`);
  }
    
 
    // === ANALYSE IA DES SYMPTÔMES ===

  // Construire les answers avec les labels lisibles (question + answer)
  const formAnswers = response.answers.map((ans) => ({
    question: questionMap.get(ans.questionId)?.label ?? ans.questionId,
    answer: ans.value,
  }));

  console.log(`🤖 [ANALYSE IA] Génération pour patient: ${normalizedPatientId}`);
  console.log(`🤖 [ANALYSE IA] Answers to analyze: ${JSON.stringify(formAnswers)}`);

  try {
    const analysis = await this.analysisService.generateFromFormAnswers(
      normalizedPatientId,
      formAnswers,
    );

    if (analysis) {
      console.log(`✅ Analyse IA sauvegardée. ID: ${analysis._id}, Gravity: ${analysis.gravity}`);
    } else {
      console.log(`⚠️ Aucune analyse IA créée pour patient ${normalizedPatientId}`);
    }
  } catch (error) {
    console.error('⚠️ Erreur lors de l’appel à l’analyse IA:', error);
  }

  // === CRÉER NOTIFICATION POUR LE MÉDECIN ===
  if (doctorId) {
    try {
      const patient = await this.userModel.findById(normalizedPatientId)
        .select('firstName lastName')
        .lean()
        .exec();

      if (patient) {
        await this.notificationsService.create({
          recipientId: doctorId,
          type: 'symptom',
          priority: 'high',
          title: 'New Symptom Report',
          message: `${patient.firstName} ${patient.lastName} submitted daily symptoms`,
          data: {
            responseId: response._id.toString(),
            vitals: response.vitals,
            formId: symptomForm._id.toString(),
            formTitle: symptomForm.title,
          },
          patientId: normalizedPatientId,
          actionUrl: `/symptoms/responses/${response._id}`,
        });
        console.log(`📬 Notification créée pour le médecin ${doctorId}`);
      }
    } catch (notifError) {
      console.error('⚠️ Erreur création notification:', notifError);
    }
  }
  // === FIN NOTIFICATION ===
}
// === FIN ANALYSE IA ===

    return response;
    //fin partie
    //return response.save();
  }

  async submitResponse(dto: SubmitResponseDto): Promise<SymptomResponse> {
    return this.saveResponse(dto);
  }


  /**
   * Extrait les vitals pour l'alerte IA (simplifié)
   */
  private extractVitalsForAlert(
  answers: Array<{ questionId: string; value: any }>,
  questionMap: Map<string, { label: string; category?: string | null }>  
) {
  const vitals: any = {
    heartRate: null,
    spo2: null,
    temperature: null,
    systolicBP: null,
    diastolicBP: null,
  };

  answers.forEach((ans) => {
    const question = questionMap.get(ans.questionId);
    const label = (question?.label || '').toLowerCase();

    if (question?.category === 'vital_parameters') {
      if (label.includes('heart rate') || label.includes('rythme cardiaque') || label.includes('pulse')) {
        vitals.heartRate = parseFloat(ans.value);
      }
      if (label.includes('spo2') || label.includes('oxygen') || label.includes('saturation')) {
        vitals.spo2 = parseFloat(ans.value);
      }
      if (label.includes('température') || label.includes('temperature') || label.includes('°c')) {
        vitals.temperature = parseFloat(ans.value);
      }
      if (label.includes('blood pressure') || label.includes('tension')) {
        if (typeof ans.value === 'string' && ans.value.includes('/')) {
          const [sys, dia] = ans.value.split('/');
          vitals.systolicBP = parseFloat(sys);
          vitals.diastolicBP = parseFloat(dia);
        }
      }
    } else if (label.includes('heart rate') || label.includes('rythme cardiaque') || label.includes('pulse')) {
      vitals.heartRate = parseFloat(ans.value);
    } else if (label.includes('spo2') || label.includes('oxygen') || label.includes('saturation')) {
      vitals.spo2 = parseFloat(ans.value);
    } else if (label.includes('température') || label.includes('temperature') || label.includes('°c')) {
      vitals.temperature = parseFloat(ans.value);
    } else if (label.includes('blood pressure') || label.includes('tension')) {
      if (typeof ans.value === 'string' && ans.value.includes('/')) {
        const [sys, dia] = ans.value.split('/');
        vitals.systolicBP = parseFloat(sys);
        vitals.diastolicBP = parseFloat(dia);
      }
    }
  });

  console.log('📊 Vitals finaux envoyés à FastAPI:', vitals);
  return vitals;
}

  //fin alerte



  async getTodayQuestionStatus(patientId: string): Promise<TodayQuestionStatus[]> {
    const normalizedPatientId = patientId?.trim();

    if (!normalizedPatientId) {
      throw new BadRequestException('Invalid patientId');
    }

    const symptomForm = await this.symptomModel
      .findOne({
        $or: [
          { patientIds: normalizedPatientId },
          { patientId: normalizedPatientId },
        ],
        isActive: true,
      })
      .sort({ createdAt: -1, _id: -1 })
      .exec();

    if (!symptomForm) {
      throw new NotFoundException(`No active symptom form found for patient ${normalizedPatientId}`);
    }

    const questionIds = symptomForm.questions
      .map((question) => question._id?.toString())
      .filter((questionId): questionId is string => !!questionId);
    const counts = await this.getTodayQuestionCounts(
      normalizedPatientId,
      symptomForm,
      questionIds,
    );

    return symptomForm.questions
      .map((question) => {
        const questionId = question._id?.toString();
        if (!questionId) {
          return null;
        }

        return this.buildTodayQuestionStatus(
          question,
          counts.get(questionId) ?? 0,
        );
      })
      .filter((status): status is TodayQuestionStatus => status !== null);
  }


  async getTodayResponse(patientId: string): Promise<SymptomResponse | null> {
    const normalizedPatientId = patientId?.trim();

    if (!normalizedPatientId) {
      throw new BadRequestException('Invalid patientId');
    }

    const today = new Date();

    return this.symptomResponseModel
      .findOne({
        patientId: normalizedPatientId,
        date: {
          $gte: this.getStartOfDay(today),
          $lt: this.getEndOfDay(today),
        },
      })
      .populate('symptomFormId', 'title isActive patientId')
      .sort({ createdAt: -1, _id: -1 })
      .exec();
  }

  async getPatientResponses(patientId: string): Promise<SymptomResponse[]> {
    const normalizedPatientId = patientId?.trim();

    if (!normalizedPatientId) {
      throw new BadRequestException('Invalid patientId');
    }

    return this.symptomResponseModel
      .find({ patientId: normalizedPatientId })
      .populate('symptomFormId', 'title isActive')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getByDate(patientId: string, date: string): Promise<SymptomResponseByDateItem[]> {
    const normalizedPatientId = patientId?.trim();

    if (!normalizedPatientId) {
      throw new BadRequestException('Invalid patientId');
    }

    const start = new Date(date);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('Invalid date');
    }

    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    const responses = await this.symptomResponseModel
      .find({
        patientId: normalizedPatientId,
        createdAt: {
          $gte: start,
          $lte: end,
        },
      })
      .populate('symptomFormId')
      .sort({ createdAt: -1, _id: -1 })
      .exec();

    return responses.map((response) => {
      const form =
        response.symptomFormId &&
        typeof response.symptomFormId === 'object' &&
        'questions' in response.symptomFormId
          ? (response.symptomFormId as unknown as Symptom)
          : null;

      const questionMap = new Map(
        (form?.questions ?? []).map((question) => [question._id?.toString(), question.label]),
      );

      return {
        formId: response.symptomFormId,
        answers: response.answers.map((answer) => ({
          question: questionMap.get(answer.questionId) ?? answer.questionId,
          answer: answer.value,
        })),
        createdAt: response.createdAt ?? response.date,
      };
    });
  }

  async getResponsesForValidation(
    authUser: AuthUserPayload,
  ): Promise<NurseVisibleResponseItem[]> {
    return this.listNurseResponses(authUser);
  }

  async getNurseResponses(authUser: AuthUserPayload): Promise<NurseVisibleResponseItem[]> {
    return this.listNurseResponses(authUser);
  }

  async getPendingNurseResponses(
    authUser: AuthUserPayload,
  ): Promise<NurseVisibleResponseItem[]> {
    return this.listNurseResponses(authUser, false);
  }

  async getValidatedNurseResponses(
    authUser: AuthUserPayload,
  ): Promise<NurseVisibleResponseItem[]> {
    return this.listNurseResponses(authUser, true);
  }

  async getNurseResponseById(
    authUser: AuthUserPayload,
    responseId: string,
  ): Promise<NurseVisibleResponseItem> {
    const staff = await this.getScopedStaffUser(authUser, ['nurse']);
    const response = await this.findVisibleResponse(responseId, staff.department);
    const patient = await this.getPatientForVisibleResponse(response, staff.department);

    return this.formatNurseResponse(response, patient);
  }

  async getCoordinatorResponses(authUser: AuthUserPayload): Promise<NurseVisibleResponseItem[]> {
    return this.listCoordinatorResponses(authUser);
  }

  async getPendingCoordinatorResponses(authUser: AuthUserPayload): Promise<NurseVisibleResponseItem[]> {
    return this.listCoordinatorResponses(authUser, false);
  }

  async getValidatedCoordinatorResponses(authUser: AuthUserPayload): Promise<NurseVisibleResponseItem[]> {
    return this.listCoordinatorResponses(authUser, true);
  }

  async getCoordinatorResponseById(
    authUser: AuthUserPayload,
    responseId: string,
  ): Promise<NurseVisibleResponseItem> {
    const staff = await this.getScopedStaffUser(authUser, ['coordinator']);
    const response = await this.findVisibleResponse(responseId, staff.department);
    const patient = await this.getPatientForVisibleResponse(response, staff.department);

    return this.formatNurseResponse(response, patient);
  }

  // async validateResponse(
  //   authUser: AuthUserPayload,
  //   responseId: string,
  //   dto: ResponseActionDto,
  // ): Promise<NurseVisibleResponseItem> {
  //   const staff = await this.getScopedStaffUser(authUser, ['nurse', 'coordinator']);
  //   const response = await this.findVisibleResponse(responseId, staff.department);
  //   const patient = await this.getPatientForVisibleResponse(response, staff.department);

  //   if (response.validated) {
  //     throw new ConflictException('Response already validated');
  //   }

  //   response.validated = true;
  //   response.validatedBy = staff.user._id.toString();
  //   response.validatedByName = this.buildUserDisplayName(staff.user);
  //   response.validatedByRole = staff.roleName;
  //   response.validatedAt = new Date();
  //   response.validationNote = dto.note?.trim() ?? '';

  //   await response.save();

  //   return this.formatNurseResponse(response, patient);
  // }

async validateResponse(
  authUser: AuthUserPayload,
  responseId: string,
  dto: ResponseActionDto,
): Promise<NurseVisibleResponseItem> {
  const staff = await this.getScopedStaffUser(authUser, ['nurse', 'coordinator']);
  const response = await this.findVisibleResponse(responseId, staff.department);
  const patient = await this.getPatientForVisibleResponse(response, staff.department);

  if (response.validated) {
    throw new ConflictException('Response already validated');
  }

  if (!staff.department) {
    throw new ForbiddenException('No department assigned to user');
  }

  if (dto.generateSuggestions) {
    const suggestions = await this.suggestionsService.generateValidationSuggestions(
      responseId,
      staff.department,
      dto.patientContext,
    );

    if (dto.socketId) {
      this.suggestionsGateway?.server?.to(dto.socketId).emit('suggestions-generated', {
        responseId,
        suggestions,
        timestamp: new Date(),
      });
    }

    return {
      ...this.formatNurseResponse(response, patient),
      suggestions,
    } as any;
  }

  response.validated = true;
  response.validatedBy = staff.user._id.toString();
  response.validatedByName = this.buildUserDisplayName(staff.user);
  response.validatedByRole = staff.roleName;
  response.validatedAt = new Date();
  response.validationNote = dto.note?.trim() ?? '';

  if (dto.enhanceWithAI && dto.note) {
    const enhancedNote = await this.enhanceValidationNote(dto.note, response, patient);
    response.validationNote = enhancedNote;
  }

  await response.save();

  if (dto.socketId) {
    this.suggestionsGateway?.server?.to(dto.socketId).emit('response-validated', {
      responseId,
      validatedBy: staff.user._id.toString(),
      validatedByName: this.buildUserDisplayName(staff.user),
      validatedAt: response.validatedAt,
      note: response.validationNote,
    });
  }

  return this.formatNurseResponse(response, patient);
}

private async enhanceValidationNote(
  originalNote: string,
  response: SymptomResponseDocument,
  patient: UserDocument,
): Promise<string> {
  const prompt = `
Improve this medical validation note while keeping the original meaning, making it more professional and precise:
Original note: "${originalNote}"
Patient context: ${patient.firstName} ${patient.lastName}
Department: ${patient.assignedDepartment}
Improved response (single sentence, professional tone):
`;

  try {
    const completion = await this.client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5,
      max_tokens: 150,
      messages: [
        { role: 'system', content: 'You are a professional medical writer.' },
        { role: 'user', content: prompt },
      ],
    });

    const enhanced = completion.choices[0]?.message?.content?.trim();
    return enhanced || originalNote;
  } catch (error) {
    console.error('Error enhancing note:', error);
    return originalNote;
  }
}
  async reportIssue(
    authUser: AuthUserPayload,
    responseId: string,
    dto: ResponseActionDto,
  ): Promise<NurseVisibleResponseItem> {
    const staff = await this.getScopedStaffUser(authUser, ['nurse', 'coordinator']);
    const response = await this.findVisibleResponse(responseId, staff.department);
    const patient = await this.getPatientForVisibleResponse(response, staff.department);

    response.issueReported = true;

    const note = dto.note?.trim();
    if (note) {
      response.validationNote = response.validationNote
        ? `${response.validationNote}\nIssue reported: ${note}`
        : note;
    }

    await response.save();

    return this.formatNurseResponse(response, patient);
  }

  async getValidatedSymptomsForDoctor(
    authUser: AuthUserPayload,
    patientId: string,
  ): Promise<NurseVisibleResponseItem[]> {
    const doctor = await this.getScopedStaffUser(authUser, ['doctor']);
    const patient = await this.getPatientById(patientId, doctor.department);
    const responses = await this.symptomResponseModel
      .find({ patientId: patient._id.toString(), validated: true })
      .populate('symptomFormId')
      .sort({ createdAt: -1, _id: -1 })
      .exec();

    return responses.map((response) => this.formatNurseResponse(response, patient));
  }

  // ── AI Question Generation ────────────────────────────────────────────────────

  async generateQuestions(dto: GenerateSymptomDto): Promise<{ questions: FrontendGeneratedQuestion[] }> {
    const title = dto.title?.trim();
    const description = dto.description?.trim() ?? '';
    const medicalService = (dto.service ?? dto.medicalService ?? '').trim();
    const section = (dto.section ?? dto.category ?? '').trim();
    const numberOfQuestions = dto.numberOfQuestions ?? 5;

    if (!title || !medicalService || !section) {
      throw new BadRequestException('Missing required fields');
    }

    const { systemPrompt, userPrompt } = this.buildPrompt({
      title,
      description,
      medicalService,
      section,
      numberOfQuestions,
    });

    try {
      const completion = await this.client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 2000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? '';
      if (!raw) {
        throw new InternalServerErrorException('Empty response from AI model');
      }

      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new SyntaxError('No JSON array found in the response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as unknown[];
      const questions = this.normalizeGeneratedQuestions(parsed, numberOfQuestions);
      if (!this.isStrictSectionOutputValid(questions, section, numberOfQuestions)) {
        this.logger.warn(
          `AI output rejected for section="${section || 'symptoms'}": invalid types, duplicates, or wrong count`,
        );
        return { questions: [] };
      }
      return { questions };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`AI generation error: ${message}`);
      return { questions: [] };
    }
  }

  private buildPrompt(data: {
    title: string;
    description: string;
    medicalService: string;
    section: string;
    numberOfQuestions: number;
  }): { systemPrompt: string; userPrompt: string } {
    const normalizedSection = this.normalizePromptSection(data.section);
    const serviceKey = Object.keys(SERVICE_CLINICAL_HINTS).find(
      (key) => key.toLowerCase() === data.medicalService.toLowerCase(),
    );
    const clinicalHints = serviceKey ? SERVICE_CLINICAL_HINTS[serviceKey] : DEFAULT_CLINICAL_HINTS;

    const systemPrompt = `
You are a senior clinical nurse specialist creating follow-up questions.

SECTION: ${normalizedSection.label}

STRICT RULES:
- You MUST generate questions ONLY for this section.
- You MUST NOT mix with other sections.
- You MUST generate EXACTLY ${data.numberOfQuestions} questions.
- You MUST avoid duplicates (same meaning or same wording).
- Output MUST be JSON ONLY, with NO text outside JSON.

SECTION RULES:
${normalizedSection.rules}

OUTPUT FORMAT (EXACT):
[
  {"question":"...","type":"..."}
]

Allowed type values for this section: ${normalizedSection.allowedTypes.join(', ')}
`.trim();

    const userPrompt = `
Form title: ${data.title}
Medical service: ${data.medicalService || 'General Medicine'}
Description: ${data.description || 'Daily patient symptom follow-up'}

Service-specific clinical hints:
${clinicalHints}

Section to generate: ${normalizedSection.label}
Generate exactly ${data.numberOfQuestions} questions.
Do not mix sections. Do not add explanations.
Return raw JSON array only using [{"question":"...","type":"..."}].
`.trim();

    return { systemPrompt, userPrompt };
  }

  private normalizePromptSection(section: string): {
    label: 'vital parameters' | 'symptoms' | 'patient context' | 'clinical data';
    category: 'vital_parameters' | 'subjective_symptoms' | 'patient_context' | 'clinical_data';
    allowedTypes: FrontendQuestionType[];
    rules: string;
  } {
    const normalized = section.trim().toLowerCase().replace(/[_-]+/g, ' ');

    if (normalized === 'vital parameters' || normalized === 'vital parameter') {
      return {
        label: 'vital parameters',
        category: 'vital_parameters',
        allowedTypes: ['number'],
        rules: [
          '- Ask ONLY numeric measurable values.',
          '- Focus on heart rate, temperature, blood pressure, and SpO2.',
          '- Type MUST be Number.',
        ].join('\n'),
      };
    }

    if (normalized === 'patient context') {
      return {
        label: 'patient context',
        category: 'patient_context',
        allowedTypes: ['yes/no', 'single choice', 'text'],
        rules: [
          '- Ask ONLY lifestyle/context questions.',
          '- Focus on smoking, activity level, and daily habits.',
          '- Use only Yes/No, Single Choice, or Text.',
        ].join('\n'),
      };
    }

    if (normalized === 'clinical data') {
      return {
        label: 'clinical data',
        category: 'clinical_data',
        allowedTypes: ['date', 'text'],
        rules: [
          '- Ask ONLY medical/clinical information questions.',
          '- Focus on medication, lab results, and medical history.',
          '- Use only Date or Text.',
        ].join('\n'),
      };
    }

    return {
      label: 'symptoms',
      category: 'subjective_symptoms',
      allowedTypes: ['yes/no', 'rating', 'text'],
      rules: [
        '- Ask ONLY subjective symptom questions.',
        '- Focus on pain, fatigue, dizziness.',
        '- Use only Yes/No, Rating Scale, or Text.',
      ].join('\n'),
    };
  }

  private isStrictSectionOutputValid(
    questions: FrontendGeneratedQuestion[],
    section: string,
    expectedCount: number,
  ): boolean {
    if (questions.length !== expectedCount) {
      return false;
    }

    const { allowedTypes } = this.normalizePromptSection(section);
    const allowedSet = new Set(allowedTypes);
    for (const question of questions) {
      if (!allowedSet.has(question.type)) {
        return false;
      }
    }

    const normalizedLabels = questions.map((question) => question.label.trim().toLowerCase());
    return new Set(normalizedLabels).size === normalizedLabels.length;
  }

  // -- Private helpers -----------------------------------------------------------

  private async findPatientUsers(): Promise<UserDocument[]> {
    const patientRoles = await this.roleModel
      .find({
        name: {
          $regex: '^patient$',
          $options: 'i',
        },
      })
      .select('_id name')
      .lean()
      .exec();
    const patientRoleIds = new Set(
      patientRoles.map((role) => role._id.toString()),
    );

    const users = await this.userModel
      .find()
      .select('_id firstName lastName email role')
      .sort({ firstName: 1, lastName: 1, _id: 1 })
      .exec();

    return users.filter((user) => this.isPatientUser(user, patientRoleIds));
  }

  private isPatientUser(
    user: UserDocument,
    patientRoleIds: Set<string>,
  ): boolean {
    const roleValue = user.role as unknown;

    if (!roleValue) {
      return false;
    }

    if (typeof roleValue === 'string') {
      return roleValue.trim().toLowerCase() === 'patient' || patientRoleIds.has(roleValue);
    }

    if (typeof roleValue === 'object' && 'name' in roleValue) {
      const roleName = roleValue.name;
      return typeof roleName === 'string' && roleName.trim().toLowerCase() === 'patient';
    }

    if (typeof (roleValue as { toString?: () => string }).toString === 'function') {
      return patientRoleIds.has(roleValue.toString());
    }

    return false;
  }

  private isPatientAssigned(patientId: string, assignedPatientIds: string[]): boolean {
    return assignedPatientIds.some(
      (assignedId) => patientId.toString() === assignedId.toString(),
    );
  }

  private async validateDailyQuestionSubmissions(
    patientId: string,
    symptomForm: SymptomDocument,
    answers: NormalizedSymptomAnswer[],
    questionById: Map<string, Question>,
  ): Promise<void> {
    const today = new Date();
    const dayRange = {
      $gte: this.getStartOfDay(today),
      $lt: this.getEndOfDay(today),
    };
    void symptomForm;

    for (const answer of answers) {
      const question = questionById.get(answer.questionId);
      if (!question) {
        continue;
      }

      const limit = this.coerceStoredOccurrenceLimit(
        question.occurrencesPerDay,
        this.coerceStoredOccurrenceLimit(
          (question as Question & { measurementsPerDay?: number }).measurementsPerDay,
          1,
        ),
      );
      const todayCount = await this.getTodayCount(
        patientId,
        question._id?.toString() ?? answer.questionId,
        dayRange,
      );
      const isLimitReached = todayCount >= limit;

      console.log(
        'CHECK:',
        question.label,
        'count:',
        todayCount,
        'limit:',
        limit,
        'limitReached:',
        isLimitReached,
      );

      if (!isLimitReached && question.required && this.isAnswerEmpty(answer.value)) {
        throw new BadRequestException(
          `${question.label} is required`,
        );
      }
    }
  }

  private async getTodayCount(
    patientId: string,
    questionId: string,
    dayRange: { $gte: Date; $lt: Date },
  ): Promise<number> {
    const rawTodayCount = await this.symptomResponseModel.countDocuments({
      patientId,
      createdAt: dayRange,
      'answers.questionId': questionId,
    });

    return Number.isFinite(rawTodayCount) ? Number(rawTodayCount) : 0;
  }

  private isAnswerEmpty(value: NormalizedSymptomAnswer['value']): boolean {
    if (value === null || value === undefined) {
      return true;
    }

    if (typeof value === 'string') {
      return value.trim() === '';
    }

    if (Array.isArray(value)) {
      return value.length === 0;
    }

    return false;
  }

  private async getTodayQuestionCounts(
    patientId: string,
    symptomForm: SymptomDocument,
    questionIds: string[],
  ): Promise<Map<string, number>> {
    const uniqueQuestionIds = questionIds.filter(
      (questionId, index, array) => array.indexOf(questionId) === index,
    );
    const counts = new Map(uniqueQuestionIds.map((questionId) => [questionId, 0]));

    if (uniqueQuestionIds.length === 0) {
      return counts;
    }

    const today = new Date();
    const responses = await this.symptomResponseModel
      .find({
        patientId,
        symptomFormId: this.getSymptomDocumentObjectId(symptomForm),
        createdAt: {
          $gte: this.getStartOfDay(today),
          $lt: this.getEndOfDay(today),
        },
        'answers.questionId': { $in: uniqueQuestionIds },
      })
      .select('answers')
      .lean()
      .exec();

    for (const response of responses as Array<{ answers?: Array<{ questionId?: string }> }>) {
      const answeredQuestionIds = new Set(
        (response.answers ?? [])
          .map((answer) => answer.questionId)
          .filter(
            (questionId): questionId is string =>
              typeof questionId === 'string' && counts.has(questionId),
          ),
      );

      for (const questionId of answeredQuestionIds) {
        counts.set(questionId, (counts.get(questionId) ?? 0) + 1);
      }
    }

    return counts;
  }

  private buildTodayQuestionStatus(
    question: Question,
    count: number,
  ): TodayQuestionStatus {
    const questionId = question._id?.toString() ?? '';
    const { occurrencesPerDay, maxOccurrencesPerDay } = this.getQuestionOccurrenceConfig(question);

    return {
      questionId,
      questionText: question.label,
      required: count < occurrencesPerDay,
      remainingRequired: Math.max(occurrencesPerDay - count, 0),
      remainingOptional: Math.max(
        maxOccurrencesPerDay - Math.max(count, occurrencesPerDay),
        0,
      ),
      isBlocked: count >= maxOccurrencesPerDay,
    };
  }

  private getQuestionOccurrenceConfig(question: Question): {
    occurrencesPerDay: number;
    maxOccurrencesPerDay: number;
  } {
    const limit = this.coerceStoredOccurrenceLimit(
      (question as Question & { measurementsPerDay?: number }).measurementsPerDay,
      this.coerceStoredOccurrenceLimit(question.occurrencesPerDay, question.required ? 1 : 0),
    );

    return {
      occurrencesPerDay: limit,
      maxOccurrencesPerDay: limit,
    };
  }

  private normalizeOccurrenceLimit(
    value: unknown,
    fallback: number,
    fieldName: string,
    questionIndex: number,
  ): number {
    const parsedValue = value === undefined || value === null ? fallback : value;

    if (
      typeof parsedValue !== 'number' ||
      !Number.isInteger(parsedValue) ||
      parsedValue < 0
    ) {
      throw new BadRequestException(
        `Question ${questionIndex + 1}: ${fieldName} must be a non-negative integer`,
      );
    }

    return parsedValue;
  }

  private coerceStoredOccurrenceLimit(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0
      ? value
      : fallback;
  }

  private getSymptomDocumentObjectId(symptomForm: SymptomDocument): Types.ObjectId {
    const rawId = (symptomForm as SymptomDocument & { id?: string })._id ?? symptomForm.id;
    const id = rawId?.toString();

    if (!id || !isValidObjectId(id)) {
      throw new BadRequestException('Invalid symptom form id');
    }

    return new Types.ObjectId(id);
  }

  private normalizeQuestions(questions: CreateQuestionDto[]): Question[] {
    if (!Array.isArray(questions)) {
      throw new BadRequestException('questions must be an array');
    }

    return questions.map((question, index) => {
      if (!question?.label?.trim()) {
        throw new BadRequestException(`Question ${index + 1}: label is required`);
      }
      if (!question?.type?.trim()) {
        throw new BadRequestException(`Question ${index + 1}: type is required`);
      }

      const options = Array.isArray(question.options)
        ? question.options
            .map((option) => option?.trim())
            .filter((option): option is string => !!option)
        : [];

      const occurrencesPerDay = this.normalizeOccurrenceLimit(
        question.occurrencesPerDay ?? question.measurementsPerDay,
        question.required ? 1 : 0,
        'occurrencesPerDay',
        index,
      );
      const measurementsPerDay = this.normalizeOccurrenceLimit(
        question.measurementsPerDay ?? question.occurrencesPerDay,
        occurrencesPerDay,
        'measurementsPerDay',
        index,
      );
      const normalizedLimit = this.normalizeOccurrenceLimit(
        measurementsPerDay,
        occurrencesPerDay,
        'measurementsPerDay',
        index,
      );
      const maxOccurrencesPerDay = normalizedLimit;

      return {
        label:    question.label.trim(),
        type:     question.type.trim() as QuestionType,
        order:    question.order ?? index,
        required: question.required ?? false,
        occurrencesPerDay: normalizedLimit,
        measurementsPerDay: normalizedLimit,
        maxOccurrencesPerDay,
        options,
        ...(question.validation ? { validation: question.validation } : {}),
        ...(question.category ? { category: question.category as QuestionCategory } : {}),
      };
    });
  }

  private normalizeGeneratedQuestions(
    questions: unknown[],
    expectedCount: number,
  ): FrontendGeneratedQuestion[] {
    if (!Array.isArray(questions)) {
      throw new BadRequestException('questions must be an array');
    }

    const normalizedQuestions = questions
      .map((question, index) => this.normalizeGeneratedQuestion(question, index))
      .filter((question): question is FrontendGeneratedQuestion => question !== null);

    return normalizedQuestions.slice(0, expectedCount);
  }

  private normalizeGeneratedQuestion(
    question: unknown,
    index: number,
  ): FrontendGeneratedQuestion | null {
    if (!question || typeof question !== 'object') {
      return null;
    }

    const record = question as Record<string, unknown>;
    const label = this.extractQuestionLabel(record);
    const type = this.normalizeGeneratedQuestionType(record.type ?? record.inputType);

    if (!label || !type) {
      return null;
    }

    return {
      label,
      type,
      options: this.normalizeGeneratedQuestionOptions(record, type, index),
      ...(typeof record.category === 'string' && record.category.trim()
        ? { category: record.category.trim() }
        : {}),
    };
  }

  private extractQuestionLabel(question: Record<string, unknown>): string {
    const labelCandidates = [
      question.label,
      question.question,
      question.questionText,
      question.prompt,
      question.text,
    ];

    for (const candidate of labelCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return '';
  }

  private normalizeGeneratedQuestionType(typeValue: unknown): FrontendQuestionType | null {
    if (typeof typeValue !== 'string') {
      return null;
    }

    const normalizedType = typeValue.trim().toLowerCase().replace(/[_-]+/g, ' ');

    const typeMap: Record<string, FrontendQuestionType> = {
      text: 'text',
      'text response': 'text',
      textarea: 'text',
      string: 'text',
      number: 'number',
      numeric: 'number',
      integer: 'number',
      float: 'number',
      rating: 'rating',
      'rating scale': 'rating',
      scale: 'rating',
      likert: 'rating',
      'yes/no': 'yes/no',
      yesno: 'yes/no',
      boolean: 'yes/no',
      bool: 'yes/no',
      checkbox: 'multiple choice',
      checkboxes: 'multiple choice',
      radio: 'single choice',
      dropdown: 'select',
      select: 'select',
      'single choice': 'single choice',
      singlechoice: 'single choice',
      choice: 'single choice',
      'single select': 'single choice',
      'multiple choice': 'multiple choice',
      multiplechoice: 'multiple choice',
      multiselect: 'multiple choice',
      'multi select': 'multiple choice',
      date: 'date',
      datetime: 'date',
    };

    const mappedType = typeMap[normalizedType];
    if (mappedType && FRONTEND_QUESTION_TYPES.includes(mappedType)) {
      return mappedType;
    }

    return null;
  }

  private normalizeGeneratedQuestionOptions(
    question: Record<string, unknown>,
    type: FrontendQuestionType,
    index: number,
  ): string[] {
    if (type === 'yes/no') {
      return ['Yes', 'No'];
    }

    if (type === 'text' || type === 'number' || type === 'rating' || type === 'date') {
      return [];
    }

    const optionSources = [
      question.options,
      question.choices,
      question.answers,
      question.values,
    ];

    const normalizedOptions = optionSources
      .flatMap((source) => (Array.isArray(source) ? source : []))
      .map((option) => {
        if (typeof option === 'string') {
          return option.trim();
        }

        if (option && typeof option === 'object') {
          const record = option as Record<string, unknown>;
          const valueCandidates = [record.label, record.value, record.text, record.name];
          const match = valueCandidates.find(
            (candidate): candidate is string =>
              typeof candidate === 'string' && candidate.trim().length > 0,
          );

          return match?.trim() ?? '';
        }

        return '';
      })
      .filter((option, optionIndex, array): option is string => !!option && array.indexOf(option) === optionIndex);

    if (normalizedOptions.length >= 2) {
      return normalizedOptions;
    }

    return [`Option ${index * 2 + 1}`, `Option ${index * 2 + 2}`];
  }

  private async listNurseResponses(
    authUser: AuthUserPayload,
    validated?: boolean,
  ): Promise<NurseVisibleResponseItem[]> {
    const nurse = await this.getScopedStaffUser(authUser, ['nurse']);
    return this.listVisibleResponsesByDepartment(nurse.department, validated);
  }

  private async listCoordinatorResponses(
    authUser: AuthUserPayload,
    validated?: boolean,
  ): Promise<NurseVisibleResponseItem[]> {
    const coordinator = await this.getScopedStaffUser(authUser, ['coordinator']);
    return this.listVisibleResponsesByDepartment(coordinator.department, validated);
  }

  private async listVisibleResponsesByDepartment(
    department: string | null,
    validated?: boolean,
  ): Promise<NurseVisibleResponseItem[]> {
    const visiblePatients = await this.getPatientsForDepartment(department);
    const patientIds = visiblePatients.map((patient) => patient._id.toString());
    if (patientIds.length === 0) {
      return [];
    }

    const query: Record<string, unknown> = {
      patientId: { $in: patientIds },
    };

    if (typeof validated === 'boolean') {
      query.validated = validated;
    }

    const responses = await this.symptomResponseModel
      .find(query)
      .populate('symptomFormId')
      .sort({ createdAt: -1, _id: -1 })
      .exec();

    const patientMap = new Map(visiblePatients.map((patient) => [patient._id.toString(), patient]));

    return responses
      .map((response) => {
        const patient = response.patientId ? patientMap.get(response.patientId) : null;
        if (!patient) {
          return null;
        }

        return this.formatNurseResponse(response, patient);
      })
      .filter((item): item is NurseVisibleResponseItem => item !== null);
  }

  private async getScopedStaffUser(
    authUser: AuthUserPayload,
    allowedRoles: string[],
  ): Promise<ScopedStaffUser> {
    const authUserId = this.extractAuthUserId(authUser);

    if (!authUserId || !isValidObjectId(authUserId)) {
      throw new ForbiddenException('Invalid authenticated user');
    }

    const staffUser = await this.userModel.findById(authUserId).exec();
    if (!staffUser) {
      throw new NotFoundException('Authenticated user not found');
    }

    const roleName = await this.resolveUserRoleName(staffUser);
    if (!allowedRoles.includes(roleName)) {
      throw new ForbiddenException('You are not allowed to access this resource');
    }

    const department = staffUser.assignedDepartment?.trim() ?? null;
    if (!department) {
      throw new ForbiddenException('Assigned department is not configured');
    }

    return {
      user: staffUser,
      roleName,
      department,
    };
  }

  private async findVisibleResponse(
    responseId: string,
    department: string | null,
  ): Promise<SymptomResponseDocument> {
    if (!responseId || !isValidObjectId(responseId)) {
      throw new BadRequestException('Invalid symptom response id');
    }

    const response = await this.symptomResponseModel
      .findById(responseId)
      .populate('symptomFormId')
      .exec();

    if (!response) {
      throw new NotFoundException(`Symptom response ${responseId} not found`);
    }

    await this.getPatientForVisibleResponse(response, department);

    return response;
  }

  private async getPatientForVisibleResponse(
    response: SymptomResponseDocument,
    department: string | null,
  ): Promise<UserDocument> {
    const patientId = response.patientId?.trim();

    if (!patientId || !isValidObjectId(patientId)) {
      throw new ForbiddenException('Response has no valid patient reference');
    }

    return this.getPatientById(patientId, department);
  }

  private async getPatientById(
    patientId: string,
    department: string | null,
  ): Promise<UserDocument> {
    const patient = await this.userModel
      .findById(patientId)
      .select('_id firstName lastName email assignedDepartment')
      .exec();

    if (!patient) {
      throw new NotFoundException(`Patient ${patientId} not found`);
    }

    if (
      department &&
      this.normalizeDepartment(patient.assignedDepartment) !== this.normalizeDepartment(department)
    ) {
      throw new ForbiddenException('You cannot access responses outside your department');
    }

    return patient;
  }

  private async getPatientsForDepartment(department: string | null): Promise<UserDocument[]> {
    if (!department) {
      return [];
    }

    const patients = await this.userModel
      .find({
        assignedDepartment: {
          $regex: `^${this.escapeRegex(department)}$`,
          $options: 'i',
        },
      })
      .select('_id firstName lastName email assignedDepartment')
      .exec();

    return patients.filter(
      (patient) =>
        this.normalizeDepartment(patient.assignedDepartment) === this.normalizeDepartment(department),
    );
  }

  private formatNurseResponse(
    response: SymptomResponseDocument,
    patient: UserDocument,
  ): NurseVisibleResponseItem {
    const form =
      response.symptomFormId &&
      typeof response.symptomFormId === 'object' &&
      'questions' in response.symptomFormId
        ? (response.symptomFormId as unknown as Symptom)
        : null;

    const questionMap = new Map(
      (form?.questions ?? []).map((question) => [question._id?.toString(), question.label]),
    );

    return {
      _id: response._id.toString(),
      patientId: patient._id.toString(),
      patientName: this.buildUserDisplayName(patient),
      patientDepartment: patient.assignedDepartment ?? '',
      patientEmail: patient.email ?? '',
      submittedAt: response.createdAt ?? response.date,
      createdAt: response.createdAt ?? response.date,
      updatedAt: response.updatedAt ?? null,
      vitals: {
        bloodPressure: response.vitals?.bloodPressure ?? null,
        heartRate: response.vitals?.heartRate ?? null,
        temperature: response.vitals?.temperature ?? null,
        weight: response.vitals?.weight ?? null,
      },
      answers: response.answers.map((answer) => ({
        question: questionMap.get(answer.questionId) ?? answer.questionId,
        answer: answer.value,
      })),
      validated: response.validated ?? false,
      validatedBy: response.validatedBy ?? null,
      validatedByName: response.validatedByName ?? null,
      validatedByRole: response.validatedByRole ?? null,
      validatedAt: response.validatedAt ?? null,
      validationNote: response.validationNote ?? '',
      issueReported: response.issueReported ?? false,
    };
  }

  private buildUserDisplayName(
    user: Pick<UserDocument, 'firstName' | 'lastName' | 'email'>,
  ): string {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return fullName || user.email || 'Unknown user';
  }

  private extractAuthUserId(authUser: { sub?: string; userId?: string } | null | undefined): string {
    return authUser?.sub ?? authUser?.userId ?? '';
  }

  private async resolveUserRoleName(user: UserDocument): Promise<string> {
    const roleValue = user.role as unknown;

    if (roleValue && typeof roleValue === 'object' && 'name' in roleValue) {
      const roleName = roleValue.name;
      return typeof roleName === 'string' ? roleName.trim().toLowerCase() : '';
    }

    if (typeof roleValue === 'string') {
      if (!isValidObjectId(roleValue)) {
        return roleValue.trim().toLowerCase();
      }

      const role = await this.roleModel.findById(roleValue).select('name').lean().exec();
      return role?.name?.trim().toLowerCase() ?? '';
    }

    return '';
  }

  private normalizeDepartment(department: string | null | undefined): string {
    return (department ?? '').trim().toLowerCase();
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private extractVitals(
    symptomForm: Symptom,
    answers: Array<{ questionId: string; value: string | number | boolean | string[] | null }>,
  ): SymptomVitalsView {
    const questionMap = new Map(
      symptomForm.questions.map((question) => [question._id?.toString(), question.label.toLowerCase()]),
    );

    const vitals: SymptomVitalsView = {
      bloodPressure: null,
      heartRate: null,
      temperature: null,
      weight: null,
    };

    for (const answer of answers) {
      const label = questionMap.get(answer.questionId) ?? '';

      if (!label) {
        continue;
      }

      if (!vitals.bloodPressure && (label.includes('blood pressure') || label === 'bp')) {
        vitals.bloodPressure = this.stringifyAnswerValue(answer.value);
      }

      if (vitals.heartRate === null && (label.includes('heart rate') || label.includes('pulse'))) {
        vitals.heartRate = this.toNullableNumber(answer.value);
      }

      if (vitals.temperature === null && label.includes('temp')) {
        vitals.temperature = this.toNullableNumber(answer.value);
      }

      if (vitals.weight === null && label.includes('weight')) {
        vitals.weight = this.toNullableNumber(answer.value);
      }
    }

    return vitals;
  }

  private toNullableNumber(value: string | number | boolean | string[] | null): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private stringifyAnswerValue(value: string | number | boolean | string[] | null): string | null {
    if (typeof value === 'string') {
      return value.trim() || null;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value.join(', ').trim() || null;
    }

    return null;
  }

  private normalizePatientIds(patientIds?: string[], patientId?: string): string[] {
    const normalizedPatientIds = [
      ...(Array.isArray(patientIds) ? patientIds : []),
      ...(typeof patientId === 'string' ? [patientId] : []),
    ]
      .map((value) => value?.trim())
      .filter((value): value is string => !!value);

    const uniquePatientIds = normalizedPatientIds.filter(
      (value, index, array) => array.indexOf(value) === index,
    );

    if (uniquePatientIds.length === 0) {
      throw new BadRequestException('patientIds must contain at least one patient id');
    }

    return uniquePatientIds;
  }

  private normalizeStatus(status?: string, isActive?: boolean): string {
    if (typeof status === 'string' && status.trim()) {
      return status.trim();
    }

    if (typeof isActive === 'boolean') {
      return isActive ? 'active' : 'inactive';
    }

    return 'active';
  }

  private resolveNextStatus(dto: UpdateSymptomDto, existing: Symptom): string | null {
    if (typeof dto.status === 'string' && dto.status.trim()) {
      return dto.status.trim();
    }

    if (typeof dto.isActive === 'boolean') {
      return dto.isActive ? 'active' : 'inactive';
    }

    if (dto.patientIds !== undefined || dto.patientId !== undefined) {
      return existing.status ?? (existing.isActive ? 'active' : 'inactive');
    }

    return null;
  }

  private getSymptomPatientIds(symptom: Symptom): string[] {
    return this.normalizeExistingPatientIds(symptom.patientIds, symptom.patientId);
  }

  private normalizeExistingPatientIds(patientIds?: unknown[], patientId?: unknown): string[] {
    return [
      ...(Array.isArray(patientIds) ? patientIds : []),
      patientId,
    ]
      .map((value) => this.normalizePatientIdValue(value))
      .filter((value, index, array): value is string => !!value && array.indexOf(value) === index);
  }

  private normalizePatientIdValue(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string') {
      return value.trim() || null;
    }

    if (typeof (value as { toString?: () => string }).toString === 'function') {
      const stringValue = value.toString().trim();
      return stringValue && stringValue !== '[object Object]' ? stringValue : null;
    }

    return null;
  }

  private serializeSymptomForm(symptom: SymptomDocument): Record<string, unknown> {
    const serialized = symptom.toObject();
    const patientIds = this.normalizeExistingPatientIds(serialized.patientIds, serialized.patientId);
    const { patientId, ...rest } = serialized;
    const questions = Array.isArray(rest.questions)
      ? rest.questions.map((question) => {
          const normalizedLimit = this.coerceStoredOccurrenceLimit(
            question.measurementsPerDay,
            this.coerceStoredOccurrenceLimit(
              question.occurrencesPerDay,
              this.coerceStoredOccurrenceLimit(question.maxOccurrencesPerDay, 1),
            ),
          );
          const occurrencesPerDay = this.coerceStoredOccurrenceLimit(
            question.occurrencesPerDay,
            normalizedLimit,
          );
          const measurementsPerDay = this.coerceStoredOccurrenceLimit(
            question.measurementsPerDay,
            occurrencesPerDay,
          );
          const maxOccurrencesPerDay = this.coerceStoredOccurrenceLimit(
            question.maxOccurrencesPerDay,
            occurrencesPerDay,
          );
          const syncedLimit = this.coerceStoredOccurrenceLimit(
            measurementsPerDay,
            this.coerceStoredOccurrenceLimit(occurrencesPerDay, maxOccurrencesPerDay),
          );

          return {
            ...question,
            occurrencesPerDay: syncedLimit,
            measurementsPerDay: syncedLimit,
            maxOccurrencesPerDay: syncedLimit,
          };
        })
      : [];

    return {
      ...rest,
      patientIds,
      questions,
      status: serialized.status ?? (serialized.isActive ? 'active' : 'inactive'),
    };
  }

  private normalizeDate(date: Date): Date {
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date');
    }

    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private normalizeDurationInDays(value: unknown): number {
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < 1
    ) {
      throw new BadRequestException('durationInDays must be a positive integer');
    }

    return value;
  }

  private calculateEndDate(startDate: Date, durationInDays: number): Date {
    return new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + durationInDays,
    );
  }

  private getStartOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private getEndOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  }
}
