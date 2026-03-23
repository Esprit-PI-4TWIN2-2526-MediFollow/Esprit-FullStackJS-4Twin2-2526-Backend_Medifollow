import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SymptomResponseDocument = SymptomResponse & HydratedDocument<SymptomResponse>;

@Schema({ timestamps: true })
export class SymptomResponse {
  @Prop({ type: Types.ObjectId, ref: 'Symptom', required: true })
  symptomFormId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @Prop({ required: true, type: Object })
  answers: Record<string, any>;
}

export const SymptomResponseSchema = SchemaFactory.createForClass(SymptomResponse);
