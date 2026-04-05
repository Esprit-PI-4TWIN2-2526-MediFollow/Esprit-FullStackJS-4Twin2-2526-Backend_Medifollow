import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class GenerateSymptomDto {
  [x: string]: any;
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(20)
  numberOfQuestions?: number;

  @IsString()
  @IsOptional()
  medicalService?: string;

  @IsEnum(['vital_parameters', 'subjective_symptoms', 'patient_context', 'clinical_data'])
  @IsOptional()
  category?: string;
}
