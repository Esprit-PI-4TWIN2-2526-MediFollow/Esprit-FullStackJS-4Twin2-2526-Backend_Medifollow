import { IsOptional, IsString } from 'class-validator';

export class ResponseActionDto {
  @IsOptional()
  @IsString()
  note?: string;
}
