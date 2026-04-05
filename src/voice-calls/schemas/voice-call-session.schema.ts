import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type VoiceCallSessionDocument = VoiceCallSession & HydratedDocument<VoiceCallSession>;

export type VoiceCallStatus = 'initiated' | 'in_progress' | 'completed' | 'failed';

@Schema({ _id: false })
export class VoiceCallAnswer {
  @Prop({ required: true })
  questionId: string;

  @Prop({ type: String, required: true })
  rawDigits: string;

  @Prop({ type: String, required: false, default: null })
  value?: string | null;

  @Prop({ type: String, required: false, default: null })
  mappedValue?: string | null;

  @Prop({ type: Object, required: false, default: null })
  interpretedValue?: string | number | boolean | string[] | null;

  @Prop({ type: Date, required: true, default: Date.now })
  answeredAt: Date;
}

export const VoiceCallAnswerSchema = SchemaFactory.createForClass(VoiceCallAnswer);

@Schema({ timestamps: true })
export class VoiceCallSession {
  @Prop({ required: false, unique: true, sparse: true, index: true })
  callSid?: string;

  @Prop({ required: false })
  patientId?: string;

  @Prop({ required: false })
  formId?: string;

  @Prop({ required: true })
  phoneNumber: string;

  @Prop({ type: String, required: false, default: null })
  digits?: string | null;

  @Prop({ type: Number, required: false, default: null })
  interpretedValue?: number | null;

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
