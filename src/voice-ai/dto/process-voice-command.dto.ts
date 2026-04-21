import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export enum VoiceAgentRole {
  PATIENT = 'PATIENT',
  DOCTOR = 'DOCTOR',
  NURSE = 'NURSE',
  ADMIN = 'ADMIN',
  LAB_TECH = 'LAB_TECH',
  INSURANCE = 'INSURANCE',
}

export enum VoiceCommandIntent {
  FILL_FIELD = 'fill_field',
  NAVIGATE = 'navigate',
  FORM_ACTION = 'form_action',
  READ_QUESTION = 'read_question',
  FETCH_DATA = 'fetch_data',
}

export class ProcessVoiceCommandDto {
  @IsEnum(VoiceCommandIntent)
  intent: VoiceCommandIntent;

  @IsString()
  @MaxLength(120)
  action: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  target?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  transcript?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  confirmed?: boolean;
}
