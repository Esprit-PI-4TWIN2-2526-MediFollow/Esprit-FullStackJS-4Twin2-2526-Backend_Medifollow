import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Question, QuestionSchema } from './question.schema';

export type SymptomDocument = Symptom & HydratedDocument<Symptom>;

@Schema({ timestamps: true })
export class Symptom {
  @Prop({ required: true })
  title: string;

  @Prop({ required: false, default: '' })
  description?: string;

  @Prop({ required: false, default: '' })
  medicalService?: string;

  @Prop({ type: [String], default: [] })
  patientIds: string[];

  @Prop({ type: String, required: false })
  patientId?: string;

  @Prop({ type: [QuestionSchema], default: [] })
  questions: Question[];

  @Prop({ required: false, default: true })
  isActive: boolean;

  @Prop({ required: false, default: 'active' })
  status?: string;
}

export const SymptomSchema = SchemaFactory.createForClass(Symptom);
