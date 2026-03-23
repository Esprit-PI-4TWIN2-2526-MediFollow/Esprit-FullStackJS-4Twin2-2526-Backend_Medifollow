import { IsMongoId, IsNotEmpty, IsObject } from 'class-validator';

export class SubmitResponseDto {
  @IsMongoId()
  @IsNotEmpty()
  patientId: string;

  @IsObject()
  answers: Record<string, any>;
}
