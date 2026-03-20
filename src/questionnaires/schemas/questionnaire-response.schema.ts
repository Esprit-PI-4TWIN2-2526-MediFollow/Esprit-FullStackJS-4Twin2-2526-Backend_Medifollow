import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type QuestionnaireResponseDocument = QuestionnaireResponse & HydratedDocument<QuestionnaireResponse>;

// Une réponse à une question
@Schema({ _id: false })
export class Answer {
  @Prop({ required: true })
  questionId: string;

  @Prop({ required: true, type: Object })
  value: any; // string | number | boolean | string[]
}

export const AnswerSchema = SchemaFactory.createForClass(Answer);

@Schema({ timestamps: true }) //pour créer les champs createdAt et updatedAt automatiquement dans la bd
export class QuestionnaireResponse {

  @Prop({ type: Types.ObjectId, ref: 'Questionnaire', required: true })
  questionnaireId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @Prop({ type: [AnswerSchema], default: [] })
  answers: Answer[];

  @Prop({ required: false })
  notes: string; // note libre du patient

  /* @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: false })
  updatedAt: Date; */
}

export const QuestionnaireResponseSchema = SchemaFactory.createForClass(QuestionnaireResponse);