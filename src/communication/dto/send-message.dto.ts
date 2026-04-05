import { IsEnum, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { MessageType, UserRole } from '../enums/message.enum';

export class SendMessageDto {

  @IsNotEmpty()
  senderId: string;

  @IsNotEmpty()
  receiverId: string;

  @IsEnum(UserRole)
  roleSender: UserRole;

  @IsEnum(UserRole)
  roleReceiver: UserRole;

  @IsEnum(MessageType)
  type: MessageType;

  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsBoolean()
  isUrgent?: boolean;

  @IsOptional()
  scheduledAt?: Date;
}
