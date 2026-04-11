import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ConsultationDocument = HydratedDocument<Consultation>;

@Schema({ timestamps: true })
export class Consultation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patient: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  doctor: Types.ObjectId;

  @Prop({ 
    type: String, 
    enum: ['scheduled', 'urgent', 'follow-up'], 
    default: 'scheduled' 
  })
  type: string;

  @Prop({ 
    type: String, 
    enum: ['pending', 'in-progress', 'completed', 'cancelled', 'no-show'], 
    default: 'pending' 
  })
  status: string;

  @Prop({ required: true })
  scheduledAt: Date;

  @Prop()
  startedAt: Date;

  @Prop()
  endedAt: Date;

  @Prop()
  duration: number; // en minutes

  @Prop()
  videoRoomId: string;

  @Prop({ type: String, enum: ['agora', 'twilio', 'jitsi'], default: 'agora' })
  videoProvider: string;

  @Prop()
  reason: string;

  @Prop()
  notes: string;

  @Prop()
  diagnosis: string;

  @Prop()
  recommendations: string;

  @Prop()
  nextAppointmentSuggested: Date;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Prescription' }] })
  prescriptions: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'MedicalDocument' }] })
  documents: Types.ObjectId[];

  @Prop({ required: true })
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const ConsultationSchema = SchemaFactory.createForClass(Consultation);
