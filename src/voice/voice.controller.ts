import { Body, Controller, Post } from '@nestjs/common';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import {
  VoiceIntentResponse,
  VoiceRoleEnum,
  VoiceService,
  VoiceSessionResponse,
} from './voice.service';

class VoiceIntentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1200)
  text: string;

  @IsEnum(VoiceRoleEnum)
  role: VoiceRoleEnum;
}

@Controller('voice')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Post('session')
  async createSession(): Promise<VoiceSessionResponse> {
    return this.voiceService.createSession();
  }

  @Post('intent')
  async detectIntent(@Body() dto: VoiceIntentDto): Promise<VoiceIntentResponse> {
    return this.voiceService.detectIntent(dto);
  }
}
