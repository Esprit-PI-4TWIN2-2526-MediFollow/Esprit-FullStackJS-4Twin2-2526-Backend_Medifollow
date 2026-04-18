import { Test, TestingModule } from '@nestjs/testing';
import { VoiceCallsController } from './voice-calls.controller';
import { VoiceCallsService } from './voice-calls.service';

jest.mock('@nestjs/axios', () => ({ HttpService: jest.fn() }), { virtual: true });

describe('VoiceCallsController', () => {
  let controller: VoiceCallsController;
  const voiceCallsService = {
    startCall: jest.fn(),
    makeCall: jest.fn(),
    handleIncomingVoice: jest.fn(),
    handleVoiceResponse: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VoiceCallsController],
      providers: [
        {
          provide: VoiceCallsService,
          useValue: voiceCallsService,
        },
      ],
    }).compile();

    controller = module.get<VoiceCallsController>(VoiceCallsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
