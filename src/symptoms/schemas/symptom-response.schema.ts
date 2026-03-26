import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SymptomResponseDocument = SymptomResponse & HydratedDocument<SymptomResponse>;

@Schema({ _id: false })
export class SymptomAnswer {
  @Prop({ required: true })
  questionId: string;

  @Prop({ required: true, type: Object })
  value: string | number | boolean | string[] | null;
}

export const SymptomAnswerSchema = SchemaFactory.createForClass(SymptomAnswer);

@Schema({ _id: false })
export class SymptomVitals {
  @Prop({ type: String, default: null })
  bloodPressure?: string | null;

  @Prop({ type: Number, default: null })
  heartRate?: number | null;

  @Prop({ type: Number, default: null })
  temperature?: number | null;

  @Prop({ type: Number, default: null })
  weight?: number | null;
}

export const SymptomVitalsSchema = SchemaFactory.createForClass(SymptomVitals);

@Schema({ timestamps: true })
export class SymptomResponse {
  @Prop({ type: Types.ObjectId, ref: 'Symptom', required: true })
  symptomFormId: Types.ObjectId;

  @Prop({ type: String, required: false })
  patientId?: string;

  @Prop({ required: true, type: Date, default: Date.now })
  date: Date;

  @Prop({ type: [SymptomAnswerSchema], default: [] })
  answers: SymptomAnswer[];

  @Prop({ type: SymptomVitalsSchema, default: () => ({}) })
  vitals?: SymptomVitals;

  @Prop({ type: Boolean, default: false })
  validated: boolean;

  @Prop({ type: String, default: null })
  validatedBy?: string | null;

  @Prop({ type: String, default: null })
  validatedByName?: string | null;

  @Prop({ type: String, default: null })
  validatedByRole?: string | null;

  @Prop({ type: Date, default: null })
  validatedAt?: Date | null;

  @Prop({ type: String, default: '' })
  validationNote: string;

  @Prop({ type: Boolean, default: false })
  issueReported: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SymptomResponseSchema = SchemaFactory.createForClass(SymptomResponse);
SymptomResponseSchema.index({ patientId: 1, createdAt: 1 });
