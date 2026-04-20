import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PrescriptionDocument = HydratedDocument<Prescription>;

class Medication {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  dosage: string;

  @Prop({ required: true })
  frequency: string;

  @Prop({ required: true })
  duration: string;

  @Prop()
  instructions: string;
}

@Schema({ timestamps: true })
export class Prescription {
  @Prop({ type: Types.ObjectId, ref: 'Consultation', required: true })
  consultation: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patient: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  doctor: Types.ObjectId;

  @Prop({ type: [Medication], required: true })
  medications: Medication[];

  @Prop({ 
    type: String, 
    enum: ['draft', 'issued', 'sent', 'dispensed'], 
    default: 'draft' 
  })
  status: string;

  @Prop()
  issuedAt: Date;

  @Prop()
  validUntil: Date;

  @Prop()
  pharmacyNotes: string;

  @Prop()
  digitalSignature: string;

  @Prop({ unique: true })
  qrCode: string;

  @Prop()
  pdfUrl: string;

  @Prop({ required: true })
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const PrescriptionSchema = SchemaFactory.createForClass(Prescription);
