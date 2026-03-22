import { IsString, IsNotEmpty, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AnswerDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  // any : string | number | boolean | string[]
  value: any;
}

export class SubmitResponseDto {

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}