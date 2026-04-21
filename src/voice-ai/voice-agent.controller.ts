import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { JwtAuthGuard } from 'src/users/auth/jwt.guard';
import { ProcessVoiceCommandDto, VoiceAgentRole } from './dto/process-voice-command.dto';
import { VoiceCommandResponseDto } from './dto/voice-command-response.dto';
import { VoiceAgentRoleGuard } from './guards/voice-agent-role.guard';
import { VoiceAgentService } from './services/voice-agent.service';

type VoiceAgentRequestUser = {
  userId?: string;
  sub?: string;
  role: VoiceAgentRole;
};

@Controller('voice-agent')
export class VoiceAgentController {
  constructor(private readonly voiceAgentService: VoiceAgentService) {}

  @Post('commands')
  @UseGuards(JwtAuthGuard, VoiceAgentRoleGuard)
  async processVoiceCommand(
    @Body() dto: ProcessVoiceCommandDto,
    @Req() req: Request & { user: VoiceAgentRequestUser },
  ): Promise<VoiceCommandResponseDto> {
    const userId = req.user.userId ?? req.user.sub ?? '';

    return this.voiceAgentService.processVoiceCommand(dto, {
      userId,
      role: req.user.role,
    });
  }
}
