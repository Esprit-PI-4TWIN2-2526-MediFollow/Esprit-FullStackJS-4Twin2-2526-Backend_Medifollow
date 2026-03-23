import { IsString, IsArray } from 'class-validator';

export class CreateSymptomDto {

  @IsString()
  title: string;

  @IsArray()
  questions: any[];
}