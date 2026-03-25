import {
  IsOptional,
} from 'class-validator';

export class SubmitResponseDto {
  @IsOptional()
  formId: string;

  @IsOptional()
  patientId?: string;

  @IsOptional()
  answers: any;

  @IsOptional()
  date?: Date;
}
