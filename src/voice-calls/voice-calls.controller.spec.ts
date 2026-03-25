import { Test, TestingModule } from '@nestjs/testing';
import { VoiceCallsController } from './voice-calls.controller';

describe('VoiceCallsController', () => {
  let controller: VoiceCallsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VoiceCallsController],
    }).compile();

    controller = module.get<VoiceCallsController>(VoiceCallsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
