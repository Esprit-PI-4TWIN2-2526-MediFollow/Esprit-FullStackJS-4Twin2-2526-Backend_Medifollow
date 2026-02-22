import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role } from 'src/role/schemas/role.schema';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {

    @Prop({ required: true })

  nom: string;
  @Prop({ required: true})
  prenom: string;

@Prop({ required: true})
  telephone: string;
@Prop({ required: true })

  adresse: string;
  @Prop({ required: true })
  dateNaissance: Date;

@Prop({ required: true})
  sexe: string;
@Prop({ required: true })
  createdAt: Date;
@Prop({ required: true })

  updatedAt: Date;
  @Prop({ required: true })
  actif: boolean;
  @Prop({ required: false})
  specialite: string;

  @Prop({ required: false })
  diplome: string;

  @Prop({ required: false })
  grade: string;

  @Prop({ type: Types.ObjectId, ref: Role.name, required: true })
  role: Role;
  @Prop()
resetPasswordToken: string;

@Prop()
resetPasswordExpires: Date;



  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop()
  name: string;
}

export const UserSchema = SchemaFactory.createForClass(User);