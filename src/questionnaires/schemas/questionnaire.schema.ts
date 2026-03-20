import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Question, QuestionSchema } from './question.schema';

export type QuestionnaireDocument = Questionnaire & HydratedDocument<Questionnaire>;

@Schema({ timestamps: true })
export class Questionnaire {

  @Prop({ required: true })
  title: string;

  @Prop({ required: false })
  description: string;

  // Lié au service médical (Cardiologie, Neurologie, etc.)
  @Prop({ required: true })
  medicalService: string;

  @Prop({
    required: false,
    enum: ['active', 'inactive'],
    default: 'active'
  })
  status: 'active' | 'inactive';

  // Questions embarquées directement dans le document
  @Prop({ type: [QuestionSchema], default: [] })
  questions: Question[];

  @Prop({ required: false, default: 0 })
  responsesCount: number;

  /* @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: false })
  updatedAt: Date; */
}

export const QuestionnaireSchema = SchemaFactory.createForClass(Questionnaire);