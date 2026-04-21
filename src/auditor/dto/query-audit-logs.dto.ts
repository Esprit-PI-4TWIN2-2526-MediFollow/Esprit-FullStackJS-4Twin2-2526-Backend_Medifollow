import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const toInt = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
};

export class QueryAuditLogsDto {
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  userName?: string;

  @IsOptional()
  @IsString()
  departement?: string;

  @IsOptional()
  @IsIn(['CREATE', 'UPDATE', 'DELETE', 'LOGIN'])
  action?: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN';

  @IsOptional()
  @IsString()
  entity?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
