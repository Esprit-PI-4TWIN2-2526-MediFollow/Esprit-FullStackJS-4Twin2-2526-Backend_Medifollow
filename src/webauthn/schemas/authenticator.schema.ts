import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuthenticatorDocument = HydratedDocument<Authenticator>;

@Schema({ timestamps: true })
export class Authenticator {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  credentialID: string;

  @Prop({ required: true })
  credentialPublicKey: string;

  @Prop({ required: true, default: 0 })
  counter: number;

  @Prop({ required: true })
  credentialDeviceType: string;

  @Prop({ required: true, default: false })
  credentialBackedUp: boolean;

  @Prop()
  transports: string[];

  @Prop()
  deviceName: string;
}

export const AuthenticatorSchema = SchemaFactory.createForClass(Authenticator);
