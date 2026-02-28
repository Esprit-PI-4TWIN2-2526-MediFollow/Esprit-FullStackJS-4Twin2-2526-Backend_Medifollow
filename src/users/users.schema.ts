import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
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

  @Prop({ required: false })
  specialization: string;

  @Prop({ required: false })
  diploma: string;

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
  avatarUrl: string; // URL genere par Cloudinary qui sera stockée dans MongoDB
   @Prop({ required: false })
  primaryDoctor: string;


  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ type: Types.ObjectId, ref: Role.name, required: false })
  role: Role;

  @Prop({ required: false, default: true })
  actif: boolean;

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
