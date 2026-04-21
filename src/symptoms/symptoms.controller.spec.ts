import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { SymptomsController } from './symptoms.controller';
import { SymptomsService } from './symptoms.service';
import { CreateSymptomDto } from './dto/create-symptom.dto';
import { UpdateSymptomDto } from './dto/update-symptom.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';
import { ResponseActionDto } from './dto/response-action.dto';
import { GenerateSymptomDto } from './dto/generate-symptom.dto';

jest.mock('@nestjs/axios', () => ({ HttpService: jest.fn() }), { virtual: true });

describe('SymptomsController', () => {
  let controller: SymptomsController;
  let service: Record<string, jest.Mock>;

  const formId = new Types.ObjectId().toString();
  const responseId = new Types.ObjectId().toString();
  const patientId = new Types.ObjectId().toString();
  const authUser = { sub: new Types.ObjectId().toString() };
  const req = { user: authUser };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      getPatientsWithAssignmentStatus: jest.fn(),
      getLatestActive: jest.fn(),
      findFormByPatient: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      saveResponse: jest.fn(),
      getResponsesForValidation: jest.fn(),
      getTodayResponse: jest.fn(),
      getTodayQuestionStatus: jest.fn(),
      getByDate: jest.fn(),
      getPatientResponses: jest.fn(),
      getNurseResponses: jest.fn(),
      getPendingNurseResponses: jest.fn(),
      getValidatedNurseResponses: jest.fn(),
      getNurseResponseById: jest.fn(),
      getCoordinatorResponses: jest.fn(),
      getPendingCoordinatorResponses: jest.fn(),
      getValidatedCoordinatorResponses: jest.fn(),
      getCoordinatorResponseById: jest.fn(),
      validateResponse: jest.fn(),
      reportIssue: jest.fn(),
      getValidatedSymptomsForDoctor: jest.fn(),
      generateQuestions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SymptomsController],
      providers: [
        {
          provide: SymptomsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<SymptomsController>(SymptomsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a symptom form', () => {
    const dto: CreateSymptomDto = {
      title: 'Daily symptoms',
      patientIds: [patientId],
    };
    const expected = { _id: formId, ...dto };
    service.create.mockReturnValue(expected);

    expect(controller.create(dto)).toBe(expected);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should list symptom forms', () => {
    const expected = [{ _id: formId, title: 'Daily symptoms' }];
    service.findAll.mockReturnValue(expected);

    expect(controller.findAll()).toBe(expected);
    expect(service.findAll).toHaveBeenCalledWith();
  });

  it('should list patients with assignment status', () => {
    const expected = [
      {
        _id: patientId,
        name: 'Patient One',
        isAssigned: false,
      },
    ];
    service.getPatientsWithAssignmentStatus.mockReturnValue(expected);

    expect(controller.getPatientsWithAssignmentStatus()).toBe(expected);
    expect(service.getPatientsWithAssignmentStatus).toHaveBeenCalledWith();
  });

  it('should get the latest active form', () => {
    const expected = { _id: formId, isActive: true };
    service.getLatestActive.mockReturnValue(expected);

    expect(controller.getLatestActive()).toBe(expected);
    expect(service.getLatestActive).toHaveBeenCalledWith();
  });

  it('should find the active form for a patient', () => {
    const expected = { _id: formId, patientIds: [patientId] };
    service.findFormByPatient.mockReturnValue(expected);

    expect(controller.findFormByPatient(patientId)).toBe(expected);
    expect(service.findFormByPatient).toHaveBeenCalledWith(patientId);
  });

  it('should find a form by id', () => {
    const expected = { _id: formId };
    service.findById.mockReturnValue(expected);

    expect(controller.findById(formId)).toBe(expected);
    expect(service.findById).toHaveBeenCalledWith(formId);
  });

  it('should update a form', () => {
    const dto: UpdateSymptomDto = { title: 'Updated symptoms' };
    const expected = { _id: formId, ...dto };
    service.update.mockReturnValue(expected);

    expect(controller.update(formId, dto)).toBe(expected);
    expect(service.update).toHaveBeenCalledWith(formId, dto);
  });

  it('should remove a form', () => {
    service.remove.mockReturnValue(undefined);

    expect(controller.remove(formId)).toBeUndefined();
    expect(service.remove).toHaveBeenCalledWith(formId);
  });

  it('should save a symptom response', () => {
    const dto: SubmitResponseDto = {
      formId,
      patientId,
      answers: [{ questionId: new Types.ObjectId().toString(), value: 80 }],
    };
    const expected = { _id: responseId, ...dto };
    service.saveResponse.mockReturnValue(expected);

    expect(controller.createResponse(dto)).toBe(expected);
    expect(service.saveResponse).toHaveBeenCalledWith(dto);
  });

  it('should get responses for validation from the authenticated user', () => {
    const expected = [{ _id: responseId }];
    service.getResponsesForValidation.mockReturnValue(expected);

    expect(controller.getResponses(req)).toBe(expected);
    expect(service.getResponsesForValidation).toHaveBeenCalledWith(authUser);
  });

  it("should get today's response for a patient", () => {
    const expected = { _id: responseId, patientId };
    service.getTodayResponse.mockReturnValue(expected);

    expect(controller.getTodayResponse(patientId)).toBe(expected);
    expect(service.getTodayResponse).toHaveBeenCalledWith(patientId);
  });

  it("should get today's question status for a patient", () => {
    const expected = [
      {
        questionId: new Types.ObjectId().toString(),
        questionText: 'Pain level',
        required: true,
        remainingRequired: 1,
        remainingOptional: 1,
        isBlocked: false,
      },
    ];
    service.getTodayQuestionStatus.mockReturnValue(expected);

    expect(controller.getTodayQuestionStatus(patientId)).toBe(expected);
    expect(service.getTodayQuestionStatus).toHaveBeenCalledWith(patientId);
  });

  it('should get responses by date for the authenticated user', () => {
    const expected = [{ formId, answers: [] }];
    service.getByDate.mockReturnValue(expected);

    expect(controller.getByDate('2026-04-17', req)).toBe(expected);
    expect(service.getByDate).toHaveBeenCalledWith(authUser.sub, '2026-04-17');
  });

  it('should get patient responses', () => {
    const expected = [{ _id: responseId, patientId }];
    service.getPatientResponses.mockReturnValue(expected);

    expect(controller.getPatientResponses(patientId)).toBe(expected);
    expect(service.getPatientResponses).toHaveBeenCalledWith(patientId);
  });

  it('should get nurse response lists', () => {
    controller.getNurseResponses(req);
    controller.getPendingNurseResponses(req);
    controller.getValidatedNurseResponses(req);

    expect(service.getNurseResponses).toHaveBeenCalledWith(authUser);
    expect(service.getPendingNurseResponses).toHaveBeenCalledWith(authUser);
    expect(service.getValidatedNurseResponses).toHaveBeenCalledWith(authUser);
  });

  it('should get one nurse response by id', () => {
    const expected = { _id: responseId };
    service.getNurseResponseById.mockReturnValue(expected);

    expect(controller.getNurseResponseById(responseId, req)).toBe(expected);
    expect(service.getNurseResponseById).toHaveBeenCalledWith(authUser, responseId);
  });

  it('should get coordinator response lists', () => {
    controller.getCoordinatorResponses(req);
    controller.getPendingCoordinatorResponses(req);
    controller.getValidatedCoordinatorResponses(req);

    expect(service.getCoordinatorResponses).toHaveBeenCalledWith(authUser);
    expect(service.getPendingCoordinatorResponses).toHaveBeenCalledWith(authUser);
    expect(service.getValidatedCoordinatorResponses).toHaveBeenCalledWith(authUser);
  });

  it('should get one coordinator response by id', () => {
    const expected = { _id: responseId };
    service.getCoordinatorResponseById.mockReturnValue(expected);

    expect(controller.getCoordinatorResponseById(responseId, req)).toBe(expected);
    expect(service.getCoordinatorResponseById).toHaveBeenCalledWith(
      authUser,
      responseId,
    );
  });

  it('should validate a response from patch and nurse routes', () => {
    const dto: ResponseActionDto = { note: 'valid' };
    const expected = { _id: responseId, validated: true };
    service.validateResponse.mockReturnValue(expected);

    expect(controller.patchValidateResponse(responseId, dto, req)).toBe(expected);
    expect(controller.validateResponse(responseId, dto, req)).toBe(expected);
    expect(service.validateResponse).toHaveBeenNthCalledWith(
      1,
      authUser,
      responseId,
      dto,
    );
    expect(service.validateResponse).toHaveBeenNthCalledWith(
      2,
      authUser,
      responseId,
      dto,
    );
  });

  it('should report an issue from patch and coordinator routes', () => {
    const dto: ResponseActionDto = { note: 'wrong value' };
    const expected = { _id: responseId, issueReported: true };
    service.reportIssue.mockReturnValue(expected);

    expect(controller.patchSignalProblem(responseId, dto, req)).toBe(expected);
    expect(controller.reportIssueAsCoordinator(responseId, dto, req)).toBe(expected);
    expect(service.reportIssue).toHaveBeenNthCalledWith(1, authUser, responseId, dto);
    expect(service.reportIssue).toHaveBeenNthCalledWith(2, authUser, responseId, dto);
  });

  it('should get validated symptoms for a doctor', () => {
    const expected = [{ _id: responseId, validated: true }];
    service.getValidatedSymptomsForDoctor.mockReturnValue(expected);

    expect(controller.getValidatedSymptomsForDoctor(patientId, req)).toBe(expected);
    expect(service.getValidatedSymptomsForDoctor).toHaveBeenCalledWith(
      authUser,
      patientId,
    );
  });

  it('should generate symptom questions', () => {
    const dto: GenerateSymptomDto = {
      title: 'Daily cardiac check',
      medicalService: 'Cardiology',
      numberOfQuestions: 3,
    };
    const expected = { questions: [] };
    service.generateQuestions.mockReturnValue(expected);

    expect(controller.generate(dto)).toBe(expected);
    expect(service.generateQuestions).toHaveBeenCalledWith(dto);
  });
});
