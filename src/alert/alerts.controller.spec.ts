import { Test, TestingModule } from '@nestjs/testing';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

jest.mock('@nestjs/axios', () => ({ HttpService: jest.fn() }), { virtual: true });

describe('AlertsController', () => {
  let controller: AlertsController;
  const alertsService = {
    getAlertsByPatient: jest.fn(),
    findOne: jest.fn(),
    getUnreadAlertsForDoctor: jest.fn(),
    markAsRead: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertsController],
      providers: [
        {
          provide: AlertsService,
          useValue: alertsService,
        },
      ],
    }).compile();

    controller = module.get<AlertsController>(AlertsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
