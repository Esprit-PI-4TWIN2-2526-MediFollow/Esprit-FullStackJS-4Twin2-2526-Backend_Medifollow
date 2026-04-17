import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IsEnum } from 'class-validator';
import { HydratedDocument, Types } from 'mongoose';

import { Role } from 'src/role/schemas/role.schema';

export type UserDocument = User & HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {

  @Prop({ required: false })

  firstName: string;
  @Prop({ required: false })
  lastName: string;

  @Prop({ required: false })
  phoneNumber: string;
  @Prop({ required: false })

  address: string;
  @Prop({ required: false })
  dateOfBirth: Date;

  @Prop({ required: false })
  sexe: string;

  @IsEnum(['Cardiology', 'Neurology', 'Pediatrics', 'Oncology', 'General Medicine', 'Orthopedics', 'Dermatology', 'Psychiatry', 'Radiology', 'Surgery'])
  @Prop({ required: false })
  specialization: string;

  @IsEnum(['MD — Doctor of Medicine ','DES — Diploma of Specialized Studies','DESC — Diploma of Complementary Specialized Studies'])
  @Prop({ required: false })
  diploma: string;

  @IsEnum(['Jenior', 'Senior', 'Expert'])
  @Prop({ required: false })
  grade: string;
  @Prop({ required: false })
  yearsOfExperience: number;
  @Prop({ required: false })
  assignedDepartment: string;
  @Prop({ required: false })
  auditScope: string;

  @Prop({ required: false })
  profileImageName: string;

  @Prop({ default: null })
  avatarUrl: string; // URL genere par Cloudinary 
  @Prop({ required: false })
  primaryDoctor: string;


  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ default: false })
  twoFactorEnabled: boolean;

  @Prop({ type: String, default: null, select: false })
  twoFactorSecret: string | null;

  @Prop({ type: Types.ObjectId, ref: Role.name, required: false })
  role: Role;

  @Prop({ required: false, default: true })
  actif: boolean;

  @Prop({ required: false, default: false })
  mustChangePassword: boolean;

  @Prop()
  activationExpiresAt: Date;

  @Prop()
  reactivationCodeHash?: string;

  @Prop()
  reactivationCodeExpiresAt?: Date;

  @Prop({ default: 0 })
  reactivationAttempts?: number;

  @Prop()
  reactivationBlockedUntil?: Date;

  @Prop()
  resetPasswordToken: string;

  @Prop()
  resetPasswordExpires: Date;

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: false })
  updatedAt: Date;

  @Prop({ type: [Number], required: false })
  faceDescriptor: number[];

  @Prop({ required: false })
  faceImageUrl: string;

}

export const UserSchema = SchemaFactory.createForClass(User);
