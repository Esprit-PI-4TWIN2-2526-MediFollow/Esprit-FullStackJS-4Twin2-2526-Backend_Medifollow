import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type QuestionDocument = Question & HydratedDocument<Question>;

export type QuestionType =
  | 'text'
  | 'number'
  | 'scale'
  | 'single_choice'
  | 'multiple_choice'
  | 'date'
  | 'boolean';

@Schema({ _id: true })
export class Question {

  @Prop({ required: true })
  label: string;

  @Prop({
    required: true,
    enum: ['text', 'number', 'scale', 'single_choice', 'multiple_choice', 'date', 'boolean']
  })
  type: QuestionType;

  @Prop({ required: false, default: 0 })
  order: number;

  @Prop({ required: false, default: false })
  required: boolean;

  // Pour single_choice et multiple_choice
  @Prop({ type: [String], required: false, default: [] })
  options: string[];

  // Pour number et scale : min/max
  @Prop({ type: Object, required: false })
  validation: {
    min?: number;
    max?: number;
  };
}

export const QuestionSchema = SchemaFactory.createForClass(Question);