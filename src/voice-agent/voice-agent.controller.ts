import {
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import { VoiceAgentService } from './voice-agent.service';

@Controller()
export class VoiceAgentController {
  constructor(private readonly voiceAgentService: VoiceAgentService) {}

  @Post('voice/session')
  createSession() {
    return this.voiceAgentService.createSession();
  }

  @Get('voice/session')
  createSessionViaGet() {
    return this.voiceAgentService.createSession();
  }
}
