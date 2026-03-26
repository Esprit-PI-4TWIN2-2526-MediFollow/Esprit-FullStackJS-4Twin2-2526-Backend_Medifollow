import { Test, TestingModule } from '@nestjs/testing';
import { VoiceCallsService } from './voice-calls.service';

describe('VoiceCallsService', () => {
  let service: VoiceCallsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VoiceCallsService],
    }).compile();

    service = module.get<VoiceCallsService>(VoiceCallsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
