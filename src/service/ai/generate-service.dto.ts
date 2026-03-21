import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
 
export class GenerateServiceDto {
  @IsString()
  @IsNotEmpty({ message: 'La description est requise' })
  @MaxLength(500, { message: 'Max 500 caractères' })
  description: string;
}