import {
  IsOptional,
} from 'class-validator';

export class SubmitResponseDto {
  @IsOptional()
  formId: string;

  @IsOptional()
  patientId?: string;
//j'ai ajoute ca pour alerte
@IsOptional()
assignedDoctorId?:string
  @IsOptional()
  answers: any;

  @IsOptional()
  date?: Date;
}
