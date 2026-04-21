import { IsString, IsIn, IsOptional } from 'class-validator';

export class TranslateDto {
  @IsString()
  text: string;

  @IsIn(['fr', 'en', 'ar'])
  sourceLang: string;

  @IsIn(['fr', 'en', 'ar'])
  targetLang: string;

  @IsOptional()
  @IsString()
  context?: string; 
}