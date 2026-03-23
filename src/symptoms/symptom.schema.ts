import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SymptomDocument = Symptom & Document;

@Schema({ timestamps: true })
export class Symptom {

  @Prop()
  title: string;

  @Prop({ type: Array })
  questions: {
    label: string;
    type: string;
    options?: string[];
  }[];

  @Prop({ default: true })
  isActive: boolean;
}

export const SymptomSchema = SchemaFactory.createForClass(Symptom);