// src/chat/schemas/message.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from 'src/users/users.schema';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ timestamps: true, collection: 'messages' })
export class Message {

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  sender: Types.ObjectId; 

  @Prop({ required: true })
  senderRoleName: string; 

  @Prop({ required: true })
  roomId: string;

  @Prop({ required: true })
  content: string;

  @Prop({ default: false })
  read: boolean;
}

export const MessageSchema = SchemaFactory.createForClass(Message);