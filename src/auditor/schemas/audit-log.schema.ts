import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type AuditLogDocument = AuditLog & HydratedDocument<AuditLog>;

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN';

@Schema({
  collection: 'audit_logs',
  versionKey: false,
})
export class AuditLog {
  @Prop({ type: String, index: true, required: false })
  userId?: string;

  @Prop({ type: String, required: true })
  action: AuditAction;

  @Prop({ type: String, required: false })
  departement?: string;

  @Prop({ type: Date, required: true, index: true })
  timestamp: Date;

  @Prop({ type: String, required: true })
  method: string;

  @Prop({ type: String, required: true })
  endpoint: string;

  @Prop({ type: String, required: false })
  entity?: string;

  @Prop({ type: Object, required: false })
  changes?: Record<string, unknown>;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ userId: 1, timestamp: -1 });

