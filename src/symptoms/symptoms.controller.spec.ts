import { Test, TestingModule } from '@nestjs/testing';
import { SymptomsController } from './symptoms.controller';

describe('SymptomsController', () => {
  let controller: SymptomsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SymptomsController],
    }).compile();

    controller = module.get<SymptomsController>(SymptomsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
