import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { VoiceAgentRole, VoiceCommandIntent } from '../dto/process-voice-command.dto';

export type VoiceCommandLogDocument = HydratedDocument<VoiceCommandLog>;

@Schema({ timestamps: false, collection: 'voice_command_logs' })
export class VoiceCommandLog {
  @Prop({ required: true, trim: true })
  userId: string;

  @Prop({ required: true, enum: Object.values(VoiceAgentRole) })
  role: VoiceAgentRole;

  @Prop({ required: true, enum: Object.values(VoiceCommandIntent) })
  intent: VoiceCommandIntent;

  @Prop({ required: true, trim: true })
  action: string;

  @Prop({ required: true, default: Date.now })
  timestamp: Date;

  @Prop({ required: true })
  success: boolean;

  @Prop({ required: false, trim: true })
  message?: string;
}

export const VoiceCommandLogSchema = SchemaFactory.createForClass(VoiceCommandLog);

VoiceCommandLogSchema.index({ userId: 1, timestamp: -1 });
VoiceCommandLogSchema.index({ role: 1, timestamp: -1 });
