// src/ai-analysis/schemas/analysis.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from 'src/users/users.schema';

@Schema({ timestamps: true })
export class Analysis extends Document {

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  patient: User;

  @Prop({ required: true })
  analysis: string;

  @Prop({ type: [String], required: true })
  key_findings: string[];

  @Prop({ required: true, enum: ['low', 'medium', 'high', 'critical'] })
  gravity: string;

  @Prop({ required: true })
  confidence: number;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  answers: { question: string; answer: any }[];

  @Prop({ default: null })
  recommendations: string;
}

export const AnalysisSchema = SchemaFactory.createForClass(Analysis);