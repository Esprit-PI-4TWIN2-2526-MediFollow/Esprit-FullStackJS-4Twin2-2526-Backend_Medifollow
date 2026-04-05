import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { MessageType, UserRole } from '../enums/message.enum';

@Schema({ timestamps: true })
export class Message extends Document {

  @Prop({ required: true })
  senderId: string;

  @Prop({ required: true })
  receiverId: string;

  @Prop({ enum: UserRole, required: true })
  roleSender: UserRole;

  @Prop({ enum: UserRole, required: true })
  roleReceiver: UserRole;

  @Prop({ enum: MessageType, required: true })
  type: MessageType;

  @Prop({ required: true })
  content: string;

  @Prop({ default: false })
  isUrgent: boolean;

  @Prop()
  scheduledAt?: Date;

  @Prop({ default: false })
  read: boolean;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
