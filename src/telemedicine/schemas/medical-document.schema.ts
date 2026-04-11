import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MedicalDocumentDocument = HydratedDocument<MedicalDocument>;

class DocumentMetadata {
  @Prop()
  examDate: Date;

  @Prop()
  laboratory: string;

  @Prop()
  radiologist: string;

  @Prop()
  notes: string;
}

@Schema({ timestamps: true })
export class MedicalDocument {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patient: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  uploadedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Consultation' })
  consultation: Types.ObjectId;

  @Prop({ 
    type: String, 
    enum: ['lab-result', 'imaging', 'report', 'prescription', 'other'], 
    required: true 
  })
  type: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  fileUrl: string;

  @Prop({ required: true })
  fileType: string; // pdf, jpg, png, dicom

  @Prop({ required: true })
  fileSize: number;

  @Prop({ type: DocumentMetadata })
  metadata: DocumentMetadata;

  @Prop({ default: false })
  isConfidential: boolean;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
  sharedWith: Types.ObjectId[];

  @Prop({ required: true })
  uploadedAt: Date;

  @Prop()
  expiresAt: Date;

  @Prop({ required: true })
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const MedicalDocumentSchema = SchemaFactory.createForClass(MedicalDocument);
