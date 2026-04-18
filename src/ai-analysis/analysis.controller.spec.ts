import { Test, TestingModule } from '@nestjs/testing';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';

jest.mock('@nestjs/axios', () => ({ HttpService: jest.fn() }), { virtual: true });

describe('AnalysisController', () => {
  let controller: AnalysisController;
  const analysisService = {
    generateFromFormAnswers: jest.fn(),
    getAnalysesByPatient: jest.fn(),
    getLatestByPatient: jest.fn(),
    getAnalysisById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalysisController],
      providers: [
        {
          provide: AnalysisService,
          useValue: analysisService,
        },
      ],
    }).compile();

    controller = module.get<AnalysisController>(AnalysisController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
