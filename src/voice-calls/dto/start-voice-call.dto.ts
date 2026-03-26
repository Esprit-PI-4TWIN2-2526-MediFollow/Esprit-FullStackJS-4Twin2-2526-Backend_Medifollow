import { IsIn, IsOptional, IsString } from 'class-validator';

export class StartVoiceCallDto {
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsIn(['scheduler', 'manual'])
  triggeredBy?: 'scheduler' | 'manual';
}
