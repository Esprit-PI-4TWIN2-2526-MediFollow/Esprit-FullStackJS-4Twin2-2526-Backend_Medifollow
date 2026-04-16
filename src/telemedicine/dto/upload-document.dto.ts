import { IsString, IsNotEmpty, IsEnum, IsOptional, IsArray } from 'class-validator';

export class UploadDocumentDto {
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @IsString()
  @IsOptional()
  consultationId?: string;

  @IsEnum(['lab-result', 'imaging', 'report', 'prescription', 'other'])
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsOptional()
  sharedWith?: string[];

  @IsString()
  @IsOptional()
  examDate?: string;

  @IsString()
  @IsOptional()
  laboratory?: string;

  @IsString()
  @IsOptional()
  radiologist?: string;
}
