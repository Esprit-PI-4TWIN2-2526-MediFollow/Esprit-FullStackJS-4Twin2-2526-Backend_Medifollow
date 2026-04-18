import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';

export class UpdateConsultationDto {
  @IsEnum(['pending', 'in-progress', 'completed', 'cancelled', 'no-show'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  diagnosis?: string;

  @IsString()
  @IsOptional()
  recommendations?: string;

  @IsDateString()
  @IsOptional()
  nextAppointmentSuggested?: string;

  @IsDateString()
  @IsOptional()
  startedAt?: string;

  @IsDateString()
  @IsOptional()
  endedAt?: string;
}
