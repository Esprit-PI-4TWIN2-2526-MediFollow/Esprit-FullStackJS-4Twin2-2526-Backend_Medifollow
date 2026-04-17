//test unitaire pour questionnaire

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotFoundException } from '@nestjs/common';
import { QuestionnaireService } from './questionnaire.service';
import { Questionnaire, QuestionnaireDocument } from './schemas/questionnaire.schema';
import { QuestionnaireResponse, QuestionnaireResponseDocument } from './schemas/questionnaire-response.schema';
import { CreateQuestionnaireDto } from './dto/create-questionnaire.dto';
import { UpdateQuestionnaireDto } from './dto/update-questionnaire.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';

describe('QuestionnaireService', () => {
  let service: QuestionnaireService;
  let questionnaireModel: Model<QuestionnaireDocument>;
  let responseModel: Model<QuestionnaireResponseDocument>;

  const mockQuestionnaire = {
    _id: new Types.ObjectId(),
    title: 'Test Questionnaire',
    description: 'Test Description',
    medicalService: 'Cardiology',
    status: 'active',
    questions: [],
    responsesCount: 0,
    save: jest.fn(),
  };

  const mockQuestionnaireResponse = {
    _id: new Types.ObjectId(),
    questionnaireId: new Types.ObjectId(),
    patientId: new Types.ObjectId(),
    answers: [],
    notes: 'Test notes',
    save: jest.fn(),
  };

  beforeEach(async () => {
    const mockQuestionnaireModel = jest.fn().mockImplementation((dto) => ({
      ...mockQuestionnaire,
      ...dto,
      save: jest.fn().mockResolvedValue({ ...mockQuestionnaire, ...dto }),
    })) as any;

    Object.assign(mockQuestionnaireModel, {
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      exec: jest.fn(),
    });

    const mockResponseModel = jest.fn().mockImplementation((dto) => ({
      ...mockQuestionnaireResponse,
      ...dto,
      save: jest.fn().mockResolvedValue({ ...mockQuestionnaireResponse, ...dto }),
    })) as any;

    Object.assign(mockResponseModel, {
      find: jest.fn(),
      exec: jest.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionnaireService,
        {
          provide: getModelToken(Questionnaire.name),
          useValue: mockQuestionnaireModel,
        },
        {
          provide: getModelToken(QuestionnaireResponse.name),
          useValue: mockResponseModel,
        },
      ],
    }).compile();

    service = module.get<QuestionnaireService>(QuestionnaireService);
    questionnaireModel = module.get<Model<QuestionnaireDocument>>(getModelToken(Questionnaire.name));
    responseModel = module.get<Model<QuestionnaireResponseDocument>>(getModelToken(QuestionnaireResponse.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new questionnaire', async () => {
      const dto: CreateQuestionnaireDto = {
        title: 'Test Questionnaire',
        description: 'Test Description',
        medicalService: 'Cardiology',
      };

      const result = await service.create(dto);
      expect(result).toEqual({ ...mockQuestionnaire, ...dto });
      expect(questionnaireModel).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should return all questionnaires without filter', async () => {
      const mockQuestionnaires = [mockQuestionnaire];
      (questionnaireModel.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockQuestionnaires),
        }),
      });

      const result = await service.findAll();
      expect(result).toEqual(mockQuestionnaires);
      expect(questionnaireModel.find).toHaveBeenCalledWith({});
    });

    it('should return questionnaires filtered by medicalService', async () => {
      const mockQuestionnaires = [mockQuestionnaire];
      (questionnaireModel.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockQuestionnaires),
        }),
      });

      const result = await service.findAll('Cardiology');
      expect(result).toEqual(mockQuestionnaires);
      expect(questionnaireModel.find).toHaveBeenCalledWith({ medicalService: 'Cardiology' });
    });
  });

  describe('findOne', () => {
    it('should return a questionnaire by id', async () => {
      (questionnaireModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockQuestionnaire),
      });

      const result = await service.findOne('507f1f77bcf86cd799439011');
      expect(result).toEqual(mockQuestionnaire);
    });

    it('should throw NotFoundException if questionnaire not found', async () => {
      (questionnaireModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOne('507f1f77bcf86cd799439011')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a questionnaire', async () => {
      const dto: UpdateQuestionnaireDto = { title: 'Updated Title' };
      (questionnaireModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockQuestionnaire),
      });

      const result = await service.update('507f1f77bcf86cd799439011', dto);
      expect(result).toEqual(mockQuestionnaire);
      expect(questionnaireModel.findByIdAndUpdate).toHaveBeenCalledWith('507f1f77bcf86cd799439011', dto, { new: true });
    });

    it('should throw NotFoundException if questionnaire not found', async () => {
      (questionnaireModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.update('507f1f77bcf86cd799439011', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a questionnaire', async () => {
      (questionnaireModel.findByIdAndDelete as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockQuestionnaire),
      });

      await service.remove('507f1f77bcf86cd799439011');
      expect(questionnaireModel.findByIdAndDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should throw NotFoundException if questionnaire not found', async () => {
      (questionnaireModel.findByIdAndDelete as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.remove('507f1f77bcf86cd799439011')).rejects.toThrow(NotFoundException);
    });
  });

  describe('toggleStatus', () => {
    it('should toggle status from active to inactive', async () => {
      const questionnaire = { ...mockQuestionnaire, status: 'active', save: jest.fn().mockResolvedValue({ ...mockQuestionnaire, status: 'inactive' }) };
      (questionnaireModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(questionnaire),
      });

      const result = await service.toggleStatus('507f1f77bcf86cd799439011');
      expect(result.status).toBe('inactive');
    });

    it('should toggle status from inactive to active', async () => {
      const questionnaire = { ...mockQuestionnaire, status: 'inactive', save: jest.fn().mockResolvedValue({ ...mockQuestionnaire, status: 'active' }) };
      (questionnaireModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(questionnaire),
      });

      const result = await service.toggleStatus('507f1f77bcf86cd799439011');
      expect(result.status).toBe('active');
    });

    it('should throw NotFoundException if questionnaire not found', async () => {
      (questionnaireModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.toggleStatus('507f1f77bcf86cd799439011')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addQuestion', () => {
    it('should add a question to questionnaire', async () => {
      const dto: CreateQuestionDto = { label: 'Test Question', type: 'text' };
      const questionnaire = { ...mockQuestionnaire, questions: [], save: jest.fn().mockResolvedValue({ ...mockQuestionnaire, questions: [{ ...dto, order: 0 }] }) };
      (questionnaireModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(questionnaire),
      });

      const result = await service.addQuestion('507f1f77bcf86cd799439011', dto);
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].label).toBe('Test Question');
    });

    it('should throw NotFoundException if questionnaire not found', async () => {
      (questionnaireModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.addQuestion('507f1f77bcf86cd799439011', { label: 'Test', type: 'text' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateQuestion', () => {
    it('should update a question', async () => {
      const questionnaire = {
        ...mockQuestionnaire,
        questions: [{ _id: new Types.ObjectId('507f1f77bcf86cd799439012'), label: 'Old Text', type: 'text' }],
        save: jest.fn().mockResolvedValue(mockQuestionnaire)
      };
      (questionnaireModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(questionnaire),
      });

      const result = await service.updateQuestion('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', { label: 'New Text' });
      expect(questionnaire.questions[0].label).toBe('New Text');
    });

    it('should throw NotFoundException if questionnaire not found', async () => {
      (questionnaireModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.updateQuestion('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', {})).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if question not found', async () => {
      const questionnaire = { ...mockQuestionnaire, questions: [] };
      (questionnaireModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(questionnaire),
      });

      await expect(service.updateQuestion('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeQuestion', () => {
    it('should remove a question', async () => {
      const questionnaire = {
        ...mockQuestionnaire,
        questions: [{ _id: new Types.ObjectId('507f1f77bcf86cd799439012'), label: 'Test', type: 'text' }],
        save: jest.fn().mockResolvedValue(mockQuestionnaire)
      };
      (questionnaireModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(questionnaire),
      });

      const result = await service.removeQuestion('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012');
      expect(result.questions).toHaveLength(0);
    });

    it('should throw NotFoundException if questionnaire not found', async () => {
      (questionnaireModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.removeQuestion('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorderQuestions', () => {
    it('should reorder questions', async () => {
      const q1 = { _id: new Types.ObjectId('507f1f77bcf86cd799439012'), order: 0 };
      const q2 = { _id: new Types.ObjectId('507f1f77bcf86cd799439013'), order: 1 };
      const questionnaire = {
        ...mockQuestionnaire,
        questions: [q1, q2],
        save: jest.fn().mockResolvedValue(mockQuestionnaire)
      };
      (questionnaireModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(questionnaire),
      });

      const result = await service.reorderQuestions('507f1f77bcf86cd799439011', ['507f1f77bcf86cd799439013', '507f1f77bcf86cd799439012']);
      expect(q1.order).toBe(1);
      expect(q2.order).toBe(0);
    });

    it('should throw NotFoundException if questionnaire not found', async () => {
      (questionnaireModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.reorderQuestions('507f1f77bcf86cd799439011', [])).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitResponse', () => {
    it('should submit a response', async () => {
      const dto: SubmitResponseDto = { answers: [], notes: 'Test' };
      (questionnaireModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockQuestionnaire),
      });
      (questionnaireModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockQuestionnaire),
      });

      const result = await service.submitResponse('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', dto);
      expect(result).toEqual({ ...mockQuestionnaireResponse, questionnaireId: new Types.ObjectId('507f1f77bcf86cd799439011'), patientId: new Types.ObjectId('507f1f77bcf86cd799439012'), answers: [], notes: 'Test' });
    });

    it('should throw NotFoundException if questionnaire not found', async () => {
      (questionnaireModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.submitResponse('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', { answers: [] })).rejects.toThrow(NotFoundException);
    });
  });

  describe('getResponses', () => {
    it('should return responses for a questionnaire', async () => {
      const mockResponses = [mockQuestionnaireResponse];
      (responseModel.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockResponses),
      });

      const result = await service.getResponses('507f1f77bcf86cd799439011');
      expect(result).toEqual(mockResponses);
    });
  });

  describe('getPatientResponses', () => {
    it('should return responses for a patient', async () => {
      const mockResponses = [mockQuestionnaireResponse];
      (responseModel.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockResponses),
      });

      const result = await service.getPatientResponses('507f1f77bcf86cd799439011');
      expect(result).toEqual(mockResponses);
    });
  });

  describe('archive', () => {
    it('should archive a questionnaire', async () => {
      (questionnaireModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockQuestionnaire, status: 'archived', archivedAt: new Date() }),
      });

      const result = await service.archive('507f1f77bcf86cd799439011');
      expect(result.status).toBe('archived');
      expect(result.archivedAt).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException if questionnaire not found', async () => {
      (questionnaireModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.archive('507f1f77bcf86cd799439011')).rejects.toThrow(NotFoundException);
    });
  });

  describe('restore', () => {
    it('should restore a questionnaire', async () => {
      (questionnaireModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockQuestionnaire, status: 'active', archivedAt: null }),
      });

      const result = await service.restore('507f1f77bcf86cd799439011');
      expect(result.status).toBe('active');
      expect(result.archivedAt).toBeNull();
    });

    it('should throw NotFoundException if questionnaire not found', async () => {
      (questionnaireModel.findByIdAndUpdate as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.restore('507f1f77bcf86cd799439011')).rejects.toThrow(NotFoundException);
    });
  });
});
