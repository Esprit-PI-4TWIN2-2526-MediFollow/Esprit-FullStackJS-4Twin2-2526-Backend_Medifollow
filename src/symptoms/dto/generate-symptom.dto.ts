import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class GenerateQuestionsDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(20)
  numberOfQuestions?: number;

  @IsString()
  @IsNotEmpty()
  service: string;

  @IsString()
  @IsNotEmpty()
  section: string;

  // Backward-compatible aliases
  @IsString()
  @IsOptional()
  medicalService?: string;

  @IsString()
  @IsOptional()
  category?: string;
}

export { GenerateQuestionsDto as GenerateSymptomDto };
