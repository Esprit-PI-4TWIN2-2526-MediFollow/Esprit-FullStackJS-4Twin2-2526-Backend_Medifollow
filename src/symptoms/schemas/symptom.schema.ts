import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Question, QuestionSchema } from './question.schema';

export type SymptomDocument = Symptom & HydratedDocument<Symptom>;

@Schema({ timestamps: true })
export class Symptom {
  @Prop({ required: true })
  title: string;

  @Prop({ type: String, required: true })
  patientId: string;

  @Prop({ type: [QuestionSchema], default: [] })
  questions: Question[];

  @Prop({ required: false, default: true })
  isActive: boolean;
}

export const SymptomSchema = SchemaFactory.createForClass(Symptom);
