import { Test, TestingModule } from '@nestjs/testing';
import { CoordinatorController } from './coordinator.controller';
import { CoordinatorService } from './coordinator.service';

describe('CoordinatorController', () => {
  let controller: CoordinatorController;

  const coordinatorService = {
    getDashboard: jest.fn(),
    getFollowUpProtocol: jest.fn(),
    getPatientFollowUpProtocol: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoordinatorController],
      providers: [
        {
          provide: CoordinatorService,
          useValue: coordinatorService,
        },
      ],
    }).compile();

    controller = module.get<CoordinatorController>(CoordinatorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate getDashboard to service', async () => {
    const req = { user: { sub: '507f1f77bcf86cd799439011' } };
    const range = '30d';
    const expected = { statistics: { completedQuestionnaires: 1 } };
    coordinatorService.getDashboard.mockResolvedValue(expected);

    const result = await controller.getDashboard(req, range);

    expect(coordinatorService.getDashboard).toHaveBeenCalledWith(req.user, range);
    expect(result).toEqual(expected);
  });

  it('should delegate getFollowUpProtocol to service', async () => {
    const req = { user: { sub: '507f1f77bcf86cd799439011' } };
    const expected = [{ patientId: 'p1' }];
    coordinatorService.getFollowUpProtocol.mockResolvedValue(expected);

    const result = await controller.getFollowUpProtocol(req);

    expect(coordinatorService.getFollowUpProtocol).toHaveBeenCalledWith(req.user);
    expect(result).toEqual(expected);
  });

  it('should delegate getPatientFollowUpProtocol to service', async () => {
    const req = { user: { sub: '507f1f77bcf86cd799439011' } };
    const patientId = '507f1f77bcf86cd799439012';
    const expected = { patientId };
    coordinatorService.getPatientFollowUpProtocol.mockResolvedValue(expected);

    const result = await controller.getPatientFollowUpProtocol(req, patientId);

    expect(coordinatorService.getPatientFollowUpProtocol).toHaveBeenCalledWith(req.user, patientId);
    expect(result).toEqual(expected);
  });
});
