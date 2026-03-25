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

  createdAt?: Date;
  updatedAt?: Date;
}

export const SymptomResponseSchema = SchemaFactory.createForClass(SymptomResponse);
