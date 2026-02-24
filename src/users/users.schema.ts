import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { Role } from 'src/role/schemas/role.schema';

export type UserDocument = User & HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {

  @Prop({ required: true })

  nom: string;
  @Prop({ required: true })
  prenom: string;

  @Prop({ required: true })
  telephone: string;
  @Prop({ required: true })

  adresse: string;
  @Prop({ required: false })
  dateNaissance: Date;

  @Prop({ required: true })
  sexe: string;

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


}

export const UserSchema = SchemaFactory.createForClass(User);
