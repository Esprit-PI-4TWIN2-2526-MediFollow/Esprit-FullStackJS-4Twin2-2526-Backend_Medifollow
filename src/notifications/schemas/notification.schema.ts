import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/users.schema';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  recipientId: User; // Doctor ID

  @Prop({ 
    required: true,
    enum: ['symptom', 'consultation', 'upcoming-consultation', 'questionnaire', 'prescription', 'appointment']
  })
  type: string;

  @Prop({ 
    required: true,
    enum: ['critical', 'high', 'medium', 'low']
  })
  priority: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  data: any; // Flexible data for each notification type

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  patientId: User;

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ default: null })
  readAt: Date;

  @Prop({ default: null })
  actionUrl: string; // Frontend route to navigate to

  @Prop({ default: null })
  expiresAt: Date; // Auto-delete old notifications

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Add indexes for performance
NotificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, priority: 1, createdAt: -1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
