import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { SymptomsService } from './symptoms.service';
import { Symptom } from './schemas/symptom.schema';
import { SymptomResponse } from './schemas/symptom-response.schema';
import { User } from 'src/users/users.schema';
import { Role } from 'src/role/schemas/role.schema';
import { AlertsService } from 'src/alert/alerts.service';
import { AnalysisService } from 'src/ai-analysis/analysis.service';
import { CreateSymptomDto } from './dto/create-symptom.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';
import { UpdateSymptomDto } from './dto/update-symptom.dto';

jest.mock('@nestjs/axios', () => ({ HttpService: jest.fn() }), { virtual: true });

type QueryMock = {
  sort: jest.Mock;
  populate: jest.Mock;
  select: jest.Mock;
  lean: jest.Mock;
  exec: jest.Mock;
};

const mockQuery = (result: unknown): QueryMock => {
  const query = {
    sort: jest.fn(),
    populate: jest.fn(),
    select: jest.fn(),
    lean: jest.fn(),
    exec: jest.fn().mockResolvedValue(result),
  };

  query.sort.mockReturnValue(query);
  query.populate.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.lean.mockReturnValue(query);

  return query;
};

describe('SymptomsService', () => {
  let service: SymptomsService;
  let symptomModel: any;
  let symptomResponseModel: any;
  let userModel: any;
  let roleModel: any;
  let alertsService: { checkAndCreateAlert: jest.Mock };
  let analysisService: { generateFromFormAnswers: jest.Mock };

  const formId = new Types.ObjectId();
  const patientId = new Types.ObjectId().toString();
  const staffId = new Types.ObjectId().toString();
  const responseId = new Types.ObjectId();
  const bloodPressureQuestionId = new Types.ObjectId();
  const heartRateQuestionId = new Types.ObjectId();
  const painQuestionId = new Types.ObjectId();

  const questions = [
    {
      _id: bloodPressureQuestionId,
      label: 'Blood pressure',
      type: 'text',
      category: 'vital_parameters',
      order: 0,
      required: true,
      occurrencesPerDay: 1,
      maxOccurrencesPerDay: 2,
      options: [],
    },
    {
      _id: heartRateQuestionId,
      label: 'Heart rate',
      type: 'number',
      category: 'vital_parameters',
      order: 1,
      required: true,
      occurrencesPerDay: 1,
      maxOccurrencesPerDay: 2,
      options: [],
    },
    {
      _id: painQuestionId,
      label: 'Pain level',
      type: 'rating',
      category: 'subjective_symptoms',
      order: 2,
      required: false,
      occurrencesPerDay: 0,
      maxOccurrencesPerDay: 3,
      options: [],
    },
  ];

  const makeSymptomDoc = (overrides: Record<string, unknown> = {}) => {
    const data = {
      _id: formId,
      id: formId.toString(),
      title: 'Daily symptoms',
      description: 'Daily follow-up',
      medicalService: 'Cardiology',
      patientIds: [patientId],
      patientId,
      questions,
      isActive: true,
      status: 'active',
      createdAt: new Date('2026-04-17T08:00:00.000Z'),
      updatedAt: new Date('2026-04-17T08:00:00.000Z'),
      ...overrides,
    };

    return {
      ...data,
      toObject: jest.fn().mockReturnValue({ ...data }),
    };
  };

  const makeResponseDoc = (overrides: Record<string, unknown> = {}) => ({
    _id: responseId,
    symptomFormId: makeSymptomDoc(),
    patientId,
    answers: [
      { questionId: bloodPressureQuestionId.toString(), value: '120/80' },
      { questionId: heartRateQuestionId.toString(), value: 80 },
    ],
    date: new Date('2026-04-17T00:00:00.000Z'),
    vitals: {
      bloodPressure: '120/80',
      heartRate: 80,
      temperature: null,
      weight: null,
    },
    validated: false,
    validatedBy: null,
    validatedByName: null,
    validatedByRole: null,
    validatedAt: null,
    validationNote: '',
    issueReported: false,
    createdAt: new Date('2026-04-17T09:00:00.000Z'),
    updatedAt: new Date('2026-04-17T09:00:00.000Z'),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  beforeEach(async () => {
    process.env.GROQ_API_KEY = 'test-key';

    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    symptomModel = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      updateMany: jest.fn(),
    };

    symptomResponseModel = jest.fn().mockImplementation((data) => ({
      _id: responseId,
      ...data,
      save: jest.fn().mockResolvedValue(undefined),
    }));
    Object.assign(symptomResponseModel, {
      countDocuments: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
    });

    userModel = {
      find: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
    };

    roleModel = {
      find: jest.fn(),
      findById: jest.fn(),
    };

    alertsService = {
      checkAndCreateAlert: jest.fn().mockResolvedValue(null),
    };

    analysisService = {
      generateFromFormAnswers: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SymptomsService,
        {
          provide: getModelToken(Symptom.name),
          useValue: symptomModel,
        },
        {
          provide: getModelToken(SymptomResponse.name),
          useValue: symptomResponseModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: userModel,
        },
        {
          provide: getModelToken(Role.name),
          useValue: roleModel,
        },
        {
          provide: AlertsService,
          useValue: alertsService,
        },
        {
          provide: AnalysisService,
          useValue: analysisService,
        },
      ],
    }).compile();

    service = module.get<SymptomsService>(SymptomsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an active symptom form and deactivate older active forms for the same patients', async () => {
      const dto: CreateSymptomDto = {
        title: '  Daily symptoms  ',
        description: '  Morning follow-up  ',
        medicalService: '  Cardiology  ',
        patientIds: [patientId, patientId],
        patientId,
        questions: [
          {
            label: '  Heart rate  ',
            type: 'number',
            category: 'vital_parameters',
            required: true,
            options: ['  '],
          },
        ],
      };
      const createdDoc = makeSymptomDoc({
        title: 'Daily symptoms',
        description: 'Morning follow-up',
        questions: [
          {
            label: 'Heart rate',
            type: 'number',
            category: 'vital_parameters',
            order: 0,
            required: true,
            options: [],
          },
        ],
      });

      symptomModel.updateMany.mockReturnValue(mockQuery({ modifiedCount: 1 }));
      symptomModel.create.mockResolvedValue(createdDoc);

      const result = await service.create(dto);

      expect(symptomModel.updateMany).toHaveBeenCalledWith(
        {
          isActive: true,
          $or: [
            { patientIds: { $in: [patientId] } },
            { patientId: { $in: [patientId] } },
          ],
        },
        { $set: { isActive: false, status: 'inactive' } },
      );
      expect(symptomModel.create).toHaveBeenCalledWith({
        title: 'Daily symptoms',
        description: 'Morning follow-up',
        medicalService: 'Cardiology',
        patientIds: [patientId],
        patientId,
        questions: [
          {
            label: 'Heart rate',
            type: 'number',
            order: 0,
            required: true,
            occurrencesPerDay: 1,
            maxOccurrencesPerDay: 3,
            options: [],
            category: 'vital_parameters',
          },
        ],
        isActive: true,
        status: 'active',
      });
      expect(result).toMatchObject({
        title: 'Daily symptoms',
        patientIds: [patientId],
        status: 'active',
      });
      expect(result).not.toHaveProperty('patientId');
    });

    it('should reject an empty title', async () => {
      await expect(
        service.create({ title: '   ', patientId } as CreateSymptomDto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(symptomModel.create).not.toHaveBeenCalled();
    });

    it('should reject a form without patient id', async () => {
      await expect(
        service.create({ title: 'Daily symptoms' } as CreateSymptomDto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(symptomModel.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all symptom forms ordered by newest first', async () => {
      const forms = [makeSymptomDoc()];
      const query = mockQuery(forms);
      symptomModel.find.mockReturnValue(query);

      const result = await service.findAll();

      expect(symptomModel.find).toHaveBeenCalledWith();
      expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        title: 'Daily symptoms',
        patientIds: [patientId],
      });
    });
  });

  describe('getPatientsWithAssignmentStatus', () => {
    it('should mark patients assigned only when ids match by string value', async () => {
      const patientRoleId = new Types.ObjectId();
      const assignedPatientObjectId = new Types.ObjectId(patientId);
      const unassignedPatientId = new Types.ObjectId();
      const staffId = new Types.ObjectId();
      const roleQuery = mockQuery([{ _id: patientRoleId, name: 'patient' }]);
      const usersQuery = mockQuery([
        {
          _id: assignedPatientObjectId,
          firstName: 'Assigned',
          lastName: 'Patient',
          email: 'assigned@example.com',
          role: patientRoleId,
        },
        {
          _id: unassignedPatientId,
          firstName: 'Free',
          lastName: 'Patient',
          email: 'free@example.com',
          role: 'patient',
        },
        {
          _id: staffId,
          firstName: 'Doctor',
          lastName: 'User',
          email: 'doctor@example.com',
          role: 'doctor',
        },
      ]);
      const symptomsQuery = mockQuery([
        {
          patientIds: [assignedPatientObjectId],
          patientId: undefined,
        },
      ]);

      roleModel.find.mockReturnValue(roleQuery);
      userModel.find.mockReturnValue(usersQuery);
      symptomModel.find.mockReturnValue(symptomsQuery);

      const result = await service.getPatientsWithAssignmentStatus();

      expect(roleModel.find).toHaveBeenCalledWith({
        name: {
          $regex: '^patient$',
          $options: 'i',
        },
      });
      expect(symptomModel.find).toHaveBeenCalledWith({ isActive: true });
      expect(symptomsQuery.select).toHaveBeenCalledWith('patientIds patientId');
      expect(userModel.find).toHaveBeenCalledWith();
      expect(usersQuery.select).toHaveBeenCalledWith('_id firstName lastName email role');
      expect(usersQuery.sort).toHaveBeenCalledWith({ firstName: 1, lastName: 1, _id: 1 });
      expect(result).toEqual([
        {
          _id: patientId,
          name: 'Assigned Patient',
          isAssigned: true,
        },
        {
          _id: unassignedPatientId.toString(),
          name: 'Free Patient',
          isAssigned: false,
        },
      ]);
    });
  });

  describe('findById', () => {
    it('should return one symptom form by id', async () => {
      symptomModel.findById.mockReturnValue(mockQuery(makeSymptomDoc()));

      const result = await service.findById(formId.toString());

      expect(symptomModel.findById).toHaveBeenCalledWith(formId.toString());
      expect(result).toMatchObject({ title: 'Daily symptoms' });
    });

    it('should reject an invalid id', async () => {
      await expect(service.findById('invalid-id')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(symptomModel.findById).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the form does not exist', async () => {
      symptomModel.findById.mockReturnValue(mockQuery(null));

      await expect(service.findById(formId.toString())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getLatestActive', () => {
    it('should return the latest active symptom form', async () => {
      const query = mockQuery(makeSymptomDoc());
      symptomModel.findOne.mockReturnValue(query);

      const result = await service.getLatestActive();

      expect(symptomModel.findOne).toHaveBeenCalledWith({ isActive: true });
      expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(result).toMatchObject({ status: 'active' });
    });

    it('should throw NotFoundException when no active form exists', async () => {
      symptomModel.findOne.mockReturnValue(mockQuery(null));

      await expect(service.getLatestActive()).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findFormByPatient', () => {
    it('should find the active form assigned to a patient', async () => {
      const query = mockQuery(makeSymptomDoc());
      symptomModel.findOne.mockReturnValue(query);

      const result = await service.findFormByPatient(` ${patientId} `);

      expect(symptomModel.findOne).toHaveBeenCalledWith({
        $or: [{ patientIds: patientId }, { patientId }],
        isActive: true,
      });
      expect(query.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
      expect(result).toMatchObject({ patientIds: [patientId] });
    });

    it('should reject an empty patient id', async () => {
      await expect(service.findFormByPatient('   ')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('should update a form and deactivate other forms when it becomes active', async () => {
      const updateDto: UpdateSymptomDto = {
        title: ' Updated title ',
        patientIds: [patientId],
        isActive: true,
      };
      const updatedDoc = makeSymptomDoc({ title: 'Updated title' });

      symptomModel.findById.mockReturnValue(mockQuery(makeSymptomDoc({ isActive: false })));
      symptomModel.updateMany.mockReturnValue(mockQuery({ modifiedCount: 1 }));
      symptomModel.findByIdAndUpdate.mockReturnValue(mockQuery(updatedDoc));

      const result = await service.update(formId.toString(), updateDto);

      expect(symptomModel.updateMany).toHaveBeenCalledWith(
        {
          _id: { $ne: formId.toString() },
          isActive: true,
          $or: [
            { patientIds: { $in: [patientId] } },
            { patientId: { $in: [patientId] } },
          ],
        },
        { $set: { isActive: false, status: 'inactive' } },
      );
      expect(symptomModel.findByIdAndUpdate).toHaveBeenCalledWith(
        formId.toString(),
        {
          title: 'Updated title',
          patientIds: [patientId],
          patientId,
          status: 'active',
          isActive: true,
        },
        { new: true },
      );
      expect(result).toMatchObject({ title: 'Updated title' });
    });

    it('should reject an invalid form id', async () => {
      await expect(service.update('invalid-id', {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('should remove an existing form', async () => {
      symptomModel.findByIdAndDelete.mockReturnValue(mockQuery(makeSymptomDoc()));

      await expect(service.remove(formId.toString())).resolves.toBeUndefined();
      expect(symptomModel.findByIdAndDelete).toHaveBeenCalledWith(formId.toString());
    });

    it('should throw NotFoundException when the form to remove does not exist', async () => {
      symptomModel.findByIdAndDelete.mockReturnValue(mockQuery(null));

      await expect(service.remove(formId.toString())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('saveResponse', () => {
    const responseDto = (): SubmitResponseDto => ({
      formId: formId.toString(),
      patientId: ` ${patientId} `,
      assignedDoctorId: new Types.ObjectId().toString(),
      date: new Date('2026-04-17T13:45:00.000Z'),
      answers: [
        {
          questionId: bloodPressureQuestionId.toString(),
          value: '120/80',
        },
        {
          questionId: heartRateQuestionId.toString(),
          value: 80,
        },
      ],
    });

    it('should save a patient response, extract vitals, create alerts, and launch analysis', async () => {
      symptomModel.findById.mockReturnValue(mockQuery(makeSymptomDoc()));
      symptomResponseModel.find.mockReturnValue(mockQuery([]));

      const result = await service.saveResponse(responseDto());

      expect(symptomResponseModel.find).toHaveBeenCalledWith({
        patientId,
        symptomFormId: formId,
        createdAt: {
          $gte: expect.any(Date),
          $lt: expect.any(Date),
        },
        'answers.questionId': {
          $in: [
            bloodPressureQuestionId.toString(),
            heartRateQuestionId.toString(),
          ],
        },
      });
      expect(symptomResponseModel).toHaveBeenCalledWith(
        expect.objectContaining({
          symptomFormId: formId,
          patientId,
          answers: [
            {
              questionId: bloodPressureQuestionId.toString(),
              value: '120/80',
            },
            {
              questionId: heartRateQuestionId.toString(),
              value: 80,
            },
          ],
          date: new Date(2026, 3, 17),
          vitals: {
            bloodPressure: '120/80',
            heartRate: 80,
            temperature: null,
            weight: null,
          },
          validated: false,
          issueReported: false,
        }),
      );
      expect(alertsService.checkAndCreateAlert).toHaveBeenCalledWith(
        patientId,
        responseId.toString(),
        {
          heartRate: 80,
          spo2: null,
          temperature: null,
          systolicBP: 120,
          diastolicBP: 80,
        },
        expect.any(String),
      );
      expect(analysisService.generateFromFormAnswers).toHaveBeenCalledWith(
        patientId,
        [
          { question: 'Blood pressure', answer: '120/80' },
          { question: 'Heart rate', answer: 80 },
        ],
      );
      expect(result._id).toEqual(responseId);
    });

    it('should reject answers after the question daily limit is reached', async () => {
      symptomModel.findById.mockReturnValue(mockQuery(makeSymptomDoc()));
      symptomResponseModel.find.mockReturnValue(
        mockQuery([
          {
            answers: [
              { questionId: bloodPressureQuestionId.toString(), value: '120/80' },
            ],
          },
          {
            answers: [
              { questionId: bloodPressureQuestionId.toString(), value: '121/81' },
            ],
          },
        ]),
      );

      await expect(service.saveResponse(responseDto())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(symptomResponseModel).not.toHaveBeenCalled();
    });

    it('should reject an answer whose question does not belong to the form', async () => {
      symptomModel.findById.mockReturnValue(mockQuery(makeSymptomDoc()));

      await expect(
        service.saveResponse({
          ...responseDto(),
          answers: [{ questionId: new Types.ObjectId().toString(), value: 'bad' }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(symptomResponseModel).not.toHaveBeenCalled();
    });

    it('should reject duplicate question answers in one submission', async () => {
      symptomModel.findById.mockReturnValue(mockQuery(makeSymptomDoc()));

      await expect(
        service.saveResponse({
          ...responseDto(),
          answers: [
            { questionId: bloodPressureQuestionId.toString(), value: '120/80' },
            { questionId: bloodPressureQuestionId.toString(), value: '121/81' },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(symptomResponseModel.find).not.toHaveBeenCalled();
      expect(symptomResponseModel).not.toHaveBeenCalled();
    });

    it('should reject an invalid date', async () => {
      symptomModel.findById.mockReturnValue(mockQuery(makeSymptomDoc()));

      await expect(
        service.saveResponse({
          ...responseDto(),
          date: 'not-a-date' as unknown as Date,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getTodayResponse', () => {
    it('should return the latest response submitted today for a patient', async () => {
      const response = makeResponseDoc();
      const query = mockQuery(response);
      symptomResponseModel.findOne.mockReturnValue(query);

      const result = await service.getTodayResponse(` ${patientId} `);

      expect(symptomResponseModel.findOne).toHaveBeenCalledWith({
        patientId,
        date: {
          $gte: expect.any(Date),
          $lt: expect.any(Date),
        },
      });
      expect(query.populate).toHaveBeenCalledWith(
        'symptomFormId',
        'title isActive patientId',
      );
      expect(query.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
      expect(result).toBe(response);
    });
  });

  describe('getTodayQuestionStatus', () => {
    it('should return required, optional, and blocked question states for today', async () => {
      const form = makeSymptomDoc();
      const formQuery = mockQuery(form);
      symptomModel.findOne.mockReturnValue(formQuery);
      symptomResponseModel.find.mockReturnValue(
        mockQuery([
          {
            answers: [
              { questionId: heartRateQuestionId.toString(), value: 80 },
              { questionId: painQuestionId.toString(), value: 4 },
            ],
          },
          {
            answers: [
              { questionId: painQuestionId.toString(), value: 5 },
            ],
          },
          {
            answers: [
              { questionId: painQuestionId.toString(), value: 6 },
            ],
          },
        ]),
      );

      const result = await service.getTodayQuestionStatus(` ${patientId} `);

      expect(symptomModel.findOne).toHaveBeenCalledWith({
        $or: [{ patientIds: patientId }, { patientId }],
        isActive: true,
      });
      expect(formQuery.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
      expect(symptomResponseModel.find).toHaveBeenCalledWith({
        patientId,
        symptomFormId: formId,
        createdAt: {
          $gte: expect.any(Date),
          $lt: expect.any(Date),
        },
        'answers.questionId': {
          $in: [
            bloodPressureQuestionId.toString(),
            heartRateQuestionId.toString(),
            painQuestionId.toString(),
          ],
        },
      });
      expect(result).toEqual([
        {
          questionId: bloodPressureQuestionId.toString(),
          questionText: 'Blood pressure',
          required: true,
          remainingRequired: 1,
          remainingOptional: 1,
          isBlocked: false,
        },
        {
          questionId: heartRateQuestionId.toString(),
          questionText: 'Heart rate',
          required: false,
          remainingRequired: 0,
          remainingOptional: 1,
          isBlocked: false,
        },
        {
          questionId: painQuestionId.toString(),
          questionText: 'Pain level',
          required: false,
          remainingRequired: 0,
          remainingOptional: 0,
          isBlocked: true,
        },
      ]);
    });

    it('should reject an empty patient id for question status', async () => {
      await expect(service.getTodayQuestionStatus('   ')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(symptomModel.findOne).not.toHaveBeenCalled();
    });
  });

  describe('getByDate', () => {
    it('should map response question ids to readable labels', async () => {
      const response = makeResponseDoc();
      const query = mockQuery([response]);
      symptomResponseModel.find.mockReturnValue(query);

      const result = await service.getByDate(patientId, '2026-04-17');

      expect(symptomResponseModel.find).toHaveBeenCalledWith({
        patientId,
        createdAt: {
          $gte: new Date(2026, 3, 17, 0, 0, 0, 0),
          $lte: new Date(2026, 3, 17, 23, 59, 59, 999),
        },
      });
      expect(query.populate).toHaveBeenCalledWith('symptomFormId');
      expect(result).toEqual([
        {
          formId: response.symptomFormId,
          answers: [
            { question: 'Blood pressure', answer: '120/80' },
            { question: 'Heart rate', answer: 80 },
          ],
          createdAt: response.createdAt,
        },
      ]);
    });

    it('should reject an invalid date string', async () => {
      await expect(service.getByDate(patientId, 'bad-date')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('validateResponse', () => {
    it('should validate a visible response as nurse', async () => {
      const patient = {
        _id: new Types.ObjectId(patientId),
        firstName: 'Patient',
        lastName: 'One',
        email: 'patient@example.com',
        assignedDepartment: 'Cardiology',
      };
      const staff = {
        _id: new Types.ObjectId(staffId),
        firstName: 'Nurse',
        lastName: 'One',
        email: 'nurse@example.com',
        assignedDepartment: 'Cardiology',
        role: { name: 'nurse' },
      };
      const response = makeResponseDoc({ patientId });

      userModel.findById.mockImplementation((id: string) => {
        if (id === staffId) return mockQuery(staff);
        if (id === patientId) return mockQuery(patient);
        return mockQuery(null);
      });
      symptomResponseModel.findById.mockReturnValue(mockQuery(response));

      const result = await service.validateResponse(
        { sub: staffId },
        responseId.toString(),
        { note: ' Looks stable ' },
      );

      expect(response.validated).toBe(true);
      expect(response.validatedBy).toBe(staffId);
      expect(response.validatedByName).toBe('Nurse One');
      expect(response.validatedByRole).toBe('nurse');
      expect(response.validationNote).toBe('Looks stable');
      expect(response.save).toHaveBeenCalled();
      expect(result).toMatchObject({
        patientId,
        patientName: 'Patient One',
        validated: true,
        validationNote: 'Looks stable',
      });
    });

    it('should reject a response that is already validated', async () => {
      const patient = {
        _id: new Types.ObjectId(patientId),
        firstName: 'Patient',
        lastName: 'One',
        email: 'patient@example.com',
        assignedDepartment: 'Cardiology',
      };
      const staff = {
        _id: new Types.ObjectId(staffId),
        firstName: 'Nurse',
        lastName: 'One',
        assignedDepartment: 'Cardiology',
        role: { name: 'nurse' },
      };

      userModel.findById.mockImplementation((id: string) => {
        if (id === staffId) return mockQuery(staff);
        if (id === patientId) return mockQuery(patient);
        return mockQuery(null);
      });
      symptomResponseModel.findById.mockReturnValue(
        mockQuery(makeResponseDoc({ validated: true })),
      );

      await expect(
        service.validateResponse({ sub: staffId }, responseId.toString(), {}),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
