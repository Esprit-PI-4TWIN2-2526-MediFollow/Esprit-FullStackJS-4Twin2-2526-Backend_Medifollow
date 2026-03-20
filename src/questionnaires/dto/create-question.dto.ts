import {
  IsString, IsNotEmpty, IsOptional, IsEnum,
  IsBoolean, IsNumber, IsArray, ValidateNested, Min
} from 'class-validator';
import { Type } from 'class-transformer';

class ValidationDto {
  @IsNumber()
  @IsOptional()
  min?: number;

  @IsNumber()
  @IsOptional()
  max?: number;
}

export class CreateQuestionDto {

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsEnum(['text', 'number', 'scale', 'single_choice', 'multiple_choice', 'date', 'boolean'])
  type: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  order?: number;

  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  options?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ValidationDto)
  validation?: ValidationDto;
}