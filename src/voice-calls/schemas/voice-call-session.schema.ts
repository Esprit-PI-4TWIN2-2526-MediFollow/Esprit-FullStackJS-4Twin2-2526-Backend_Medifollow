import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type VoiceCallSessionDocument = VoiceCallSession & HydratedDocument<VoiceCallSession>;

export type VoiceCallStatus = 'initiated' | 'in_progress' | 'completed' | 'failed';

@Schema({ _id: false })
export class VoiceCallAnswer {
  @Prop({ required: true })
  questionId: string;

  @Prop({ required: true })
  rawDigits: string;

  @Prop({ type: String, required: false, default: null })
  mappedValue?: string | null;

  @Prop({ type: Date, required: true, default: Date.now })
  answeredAt: Date;
}

export const VoiceCallAnswerSchema = SchemaFactory.createForClass(VoiceCallAnswer);

@Schema({ timestamps: true })
export class VoiceCallSession {
  @Prop({ required: true, unique: true, index: true })
  callSid: string;

  @Prop({ required: true })
  patientId: string;

  @Prop({ required: true })
  formId: string;

  @Prop({ required: true })
  phoneNumber: string;

  @Prop({ type: Number, default: 0 })
  currentQuestionIndex: number;

  @Prop({ type: [VoiceCallAnswerSchema], default: [] })
  answers: VoiceCallAnswer[];

  @Prop({
    type: String,
    enum: ['initiated', 'in_progress', 'completed', 'failed'],
    default: 'initiated',
  })
  status: VoiceCallStatus;

  @Prop({ type: String, default: 'voice-call' })
  channel: string;

  @Prop({ type: String, default: 'twilio' })
  provider: string;

  @Prop({ type: Date, default: Date.now })
  startedAt: Date;

  @Prop({ type: Date, default: null })
  completedAt?: Date | null;

  @Prop({ type: Date, default: null })
  lastWebhookAt?: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const VoiceCallSessionSchema = SchemaFactory.createForClass(VoiceCallSession);
