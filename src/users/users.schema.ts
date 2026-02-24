import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { Role } from 'src/role/schemas/role.schema';

export type UserDocument = User & HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {

  @Prop({ required: true })

  firstName: string;
  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true })
  phoneNumber: string;
  @Prop({ required: true })

  address: string;
  @Prop({ required: false })
  dateOfBirth: Date;

  @Prop({ required: true })
  sexe: string;
  @Prop({ required: true })
  createdAt: Date;
  @Prop({ required: false })

  updatedAt: Date;
  @Prop({ required: false, default: true })
  actif: boolean;
  @Prop({ required: false })
  specialite: string;

  @Prop({ required: false })
  diplome: string;

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
   @Prop({ required: false })
  primaryDoctor: string;


  @Prop({ required: true, unique: true })
  email: string;
  @Prop({ required: true })
  password: string;

  @Prop({ type: Types.ObjectId, ref: Role.name, required: true })
  role: Role;
  @Prop()
  resetPasswordToken: string;

  @Prop()
  resetPasswordExpires: Date;


}

export const UserSchema = SchemaFactory.createForClass(User);
