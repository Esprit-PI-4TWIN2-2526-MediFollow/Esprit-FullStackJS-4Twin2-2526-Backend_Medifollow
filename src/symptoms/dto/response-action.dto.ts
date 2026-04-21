import { IsOptional, IsString } from 'class-validator';

export class ResponseActionDto {
  @IsOptional()
  @IsString()
  note?: string;
  generateSuggestions?: boolean;
  patientContext?: string;
  socketId?: string;
  enhanceWithAI?: boolean;
}
