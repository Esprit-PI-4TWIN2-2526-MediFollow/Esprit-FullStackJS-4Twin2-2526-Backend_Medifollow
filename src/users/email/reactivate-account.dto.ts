import { IsEmail, IsString, Length } from "class-validator";

class SendReactivationCodeDto {
  @IsEmail()
  email: string;
}

// DTO pour réactiver le compte
class ReactivateAccountDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6, { message: 'Code must be 6 digits' })
  code: string;
}