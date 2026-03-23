import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
} from 'class-validator';

class SymptomAnswerDto {
  @IsMongoId()
  @IsNotEmpty()
  questionId: string;

  value: string | number | boolean | string[] | null;
}

export class SubmitResponseDto {
  @IsMongoId()
  @IsNotEmpty()
  formId: string;

  @IsMongoId()
  @IsOptional()
  patientId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SymptomAnswerDto)
  answers: SymptomAnswerDto[];
}
