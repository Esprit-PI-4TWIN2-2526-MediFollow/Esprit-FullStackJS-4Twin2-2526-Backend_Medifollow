import { IsString, IsEnum, IsOptional, IsObject, IsMongoId } from 'class-validator';

export class CreateNotificationDto {
  @IsMongoId()
  recipientId: string;

  @IsEnum(['symptom', 'consultation', 'upcoming-consultation', 'questionnaire', 'prescription'])
  type: string;

  @IsEnum(['critical', 'high', 'medium', 'low'])
  priority: string;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsObject()
  @IsOptional()
  data?: any;

  @IsMongoId()
  @IsOptional()
  patientId?: string;

  @IsString()
  @IsOptional()
  actionUrl?: string;

  @IsOptional()
  expiresAt?: Date;
}
