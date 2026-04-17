import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { QuestionnaireResponse } from 'src/questionnaires/schemas/questionnaire-response.schema';
import { Questionnaire } from 'src/questionnaires/schemas/questionnaire.schema';
import { Role } from 'src/role/schemas/role.schema';
import { SymptomResponse } from 'src/symptoms/schemas/symptom-response.schema';
import { Symptom } from 'src/symptoms/schemas/symptom.schema';
import { User } from 'src/users/users.schema';
import { CoordinatorService } from './coordinator.service';

type QueryMockResult = {
  select: jest.Mock;
  lean: jest.Mock;
  exec: jest.Mock;
};

const createQueryMock = (resolvedValue: unknown): QueryMockResult => {
  const exec = jest.fn().mockResolvedValue(resolvedValue);
  const lean = jest.fn().mockReturnValue({ exec });
  const select = jest.fn().mockReturnValue({ lean, exec });
  return { select, lean, exec };
};

describe('CoordinatorService', () => {
  let service: CoordinatorService;

  const userModel = {
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  };

  const roleModel = {
    findById: jest.fn(),
    find: jest.fn(),
  };

  const questionnaireModel = {
    find: jest.fn(),
  };

  const questionnaireResponseModel = {
    find: jest.fn(),
    aggregate: jest.fn(),
  };

  const symptomModel = {
    find: jest.fn(),
  };

  const symptomResponseModel = {
    find: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoordinatorService,
        {
          provide: getModelToken(User.name),
          useValue: userModel,
        },
        {
          provide: getModelToken(Role.name),
          useValue: roleModel,
        },
        {
          provide: getModelToken(Questionnaire.name),
          useValue: questionnaireModel,
        },
        {
          provide: getModelToken(QuestionnaireResponse.name),
          useValue: questionnaireResponseModel,
        },
        {
          provide: getModelToken(Symptom.name),
          useValue: symptomModel,
        },
        {
          provide: getModelToken(SymptomResponse.name),
          useValue: symptomResponseModel,
        },
      ],
    }).compile();

    service = module.get<CoordinatorService>(CoordinatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw BadRequestException when patientId is invalid', async () => {
    await expect(service.getPatientFollowUpProtocol({ sub: '507f1f77bcf86cd799439011' }, 'bad-id')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should return an empty protocol when no scoped patients are found', async () => {
    userModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        role: '507f1f77bcf86cd799439099',
        assignedDepartment: 'Cardiology',
      }),
    });

    roleModel.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ name: 'coordinator' }),
        }),
      }),
    });

    const scopedUsersQuery = createQueryMock([]);
    userModel.find.mockReturnValue(scopedUsersQuery);

    const result = await service.getFollowUpProtocol({ sub: '507f1f77bcf86cd799439011' });

    expect(result).toEqual([]);
    expect(userModel.find).toHaveBeenCalled();
  });

  it('should throw NotFoundException when patient is outside coordinator scope', async () => {
    userModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        role: '507f1f77bcf86cd799439099',
        assignedDepartment: 'Cardiology',
      }),
    });

    roleModel.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ name: 'coordinator' }),
        }),
      }),
    });

    const scopedUsersQuery = createQueryMock([]);
    userModel.find.mockReturnValue(scopedUsersQuery);

    await expect(
      service.getPatientFollowUpProtocol(
        { sub: '507f1f77bcf86cd799439011' },
        '507f1f77bcf86cd799439012',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should compute dashboard rates from the built protocol', async () => {
    jest.spyOn(service as never, 'getCoordinatorContext' as never).mockResolvedValue({
      user: {} as never,
      department: 'Cardiology',
    });

    jest.spyOn(service as never, 'buildFollowUpProtocol' as never).mockResolvedValue([
      {
        patientId: 'p1',
        patientName: 'A',
        patientEmail: 'a@test.com',
        assignedDepartment: 'Cardiology',
        questionnaire: { completed: true },
        symptoms: { completed: true },
        vitalSigns: { completed: false },
      },
      {
        patientId: 'p2',
        patientName: 'B',
        patientEmail: 'b@test.com',
        assignedDepartment: 'Cardiology',
        questionnaire: { completed: false },
        symptoms: { completed: true },
        vitalSigns: { completed: true },
      },
    ] as never);

    jest.spyOn(service as never, 'countValidatedSymptoms' as never).mockResolvedValue(4);
    jest.spyOn(service as never, 'countPendingSymptoms' as never).mockResolvedValue(1);
    jest.spyOn(service as never, 'aggregateQuestionnaireActivity' as never).mockResolvedValue([{ date: '2026-04-10' }]);
    jest.spyOn(service as never, 'aggregateSymptomActivity' as never).mockResolvedValue([{ date: '2026-04-10' }]);
    jest.spyOn(service as never, 'aggregateValidationActivity' as never).mockResolvedValue([{ date: '2026-04-10' }]);

    userModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(10) });

    const dashboard = await service.getDashboard({ sub: '507f1f77bcf86cd799439011' }, '30d');

    expect(dashboard.scope.patientsInScope).toBe(2);
    expect(dashboard.scope.globalPatients).toBe(10);
    expect(dashboard.statistics.completedQuestionnaires).toBe(1);
    expect(dashboard.statistics.submittedSymptoms).toBe(2);
    expect(dashboard.statistics.submittedVitalSigns).toBe(1);
    expect(dashboard.rates.questionnaireCompletionRate).toBe(50);
    expect(dashboard.rates.symptomSubmissionRate).toBe(100);
    expect(dashboard.rates.vitalSignsSubmissionRate).toBe(50);
  });
});
