import { IsOptional, IsString } from 'class-validator';

export class TwilioVoiceWebhookDto {
  @IsString()
  CallSid: string;

  @IsOptional()
  @IsString()
  From?: string;

  @IsOptional()
  @IsString()
  To?: string;

  @IsOptional()
  @IsString()
  Digits?: string;

  @IsOptional()
  @IsString()
  SpeechResult?: string;
}
