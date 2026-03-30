import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { QuestionnaireResponse } from '../../questionnaires/schemas/questionnaire-response.schema';
import { User } from 'src/users/users.schema';

@Schema({ timestamps: true })
export class Alert extends Document {

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  patient: User;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'QuestionnaireResponse', required: true })
  response: QuestionnaireResponse;

  @Prop({ required: true })
  severity: 'low' | 'medium' | 'high' | 'critical';

  @Prop({ required: true })
  alertProbability: number;

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ default: null })
  readAt: Date;

  @Prop({ default: null })
  doctorId: string;   // ID du médecin qui doit voir l'alerte
}

export const AlertSchema = SchemaFactory.createForClass(Alert);