import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type VideoSessionDocument = HydratedDocument<VideoSession>;

class Participant {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop()
  joinedAt: Date;

  @Prop()
  leftAt: Date;

  @Prop()
  duration: number; // en secondes
}

class QualityMetrics {
  @Prop()
  averageBitrate: number;

  @Prop()
  packetLoss: number;

  @Prop()
  latency: number;
}

@Schema({ timestamps: true })
export class VideoSession {
  @Prop({ type: Types.ObjectId, ref: 'Consultation', required: true })
  consultation: Types.ObjectId;

  @Prop({ required: true, unique: true })
  roomId: string;

  @Prop({ required: true })
  provider: string; // agora, twilio, jitsi

  @Prop()
  token: string; // token patient

  @Prop()
  doctorToken: string; // token médecin

  @Prop({ 
    type: String, 
    enum: ['created', 'active', 'ended'], 
    default: 'created' 
  })
  status: string;

  @Prop({ type: [Participant] })
  participants: Participant[];

  @Prop()
  recordingUrl: string;

  @Prop({ type: QualityMetrics })
  quality: QualityMetrics;

  @Prop({ required: true })
  createdAt: Date;

  @Prop()
  endedAt: Date;
}

export const VideoSessionSchema = SchemaFactory.createForClass(VideoSession);
