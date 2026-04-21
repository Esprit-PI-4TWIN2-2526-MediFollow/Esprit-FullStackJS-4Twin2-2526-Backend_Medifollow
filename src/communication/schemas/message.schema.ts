// src/chat/schemas/message.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from 'src/users/users.schema';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ _id: false })
export class MessageAttachment {
  @Prop({ required: true, enum: ['image', 'audio'] })
  type: 'image' | 'audio';

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  publicId: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  originalName: string;

  @Prop({ required: true, min: 0 })
  bytes: number;

  @Prop()
  format?: string;

  @Prop()
  width?: number;

  @Prop()
  height?: number;

  @Prop()
  durationSeconds?: number;
}

export const MessageAttachmentSchema =
  SchemaFactory.createForClass(MessageAttachment);

@Schema({ timestamps: true, collection: 'messages' })
export class Message {

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  sender: Types.ObjectId; 

  @Prop({ required: true })
  senderRoleName: string; 

  @Prop({ required: true })
  roomId: string;

  @Prop({ required: true, enum: ['text', 'image', 'audio', 'mixed'], default: 'text' })
  type: 'text' | 'image' | 'audio' | 'mixed';

  @Prop({ default: '' })
  content: string;

  @Prop({ type: MessageAttachmentSchema })
  attachment?: MessageAttachment;

  @Prop({ default: false })
  read: boolean;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
