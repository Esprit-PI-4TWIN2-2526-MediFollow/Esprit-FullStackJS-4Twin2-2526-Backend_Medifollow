import { Controller, Post } from '@nestjs/common';
import { VoiceService, VoiceSessionResponse } from './voice.service';

@Controller('voice')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Post('session')
  async createSession(): Promise<VoiceSessionResponse> {
    return this.voiceService.createSession();
  }
}
