import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from 'src/role/schemas/role.schema';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
    @Prop({ required: true, unique: true })
  nom: string;
  @Prop({ required: true, unique: true })
  prenom: string;
@Prop({ required: true, unique: true })
  telephone: string;
@Prop({ required: true, unique: true })
  adresse: string;
  @Prop({ required: true, unique: true })
  dateNaissance: Date;
@Prop({ required: true, unique: true })
  sexe: string;
@Prop({ required: true, unique: true })
  createdAt: Date;
@Prop({ required: true, unique: true })
  updatedAt: Date;
  @Prop({ required: true, unique: true })
  actif: boolean;
  @Prop({ required: false, unique: false })
  specialite: string;

  @Prop({ required: false, unique: false })
  diplome: string;

  @Prop({ required: false, unique: false })
  grade: string;

  @Prop({ required: true, unique: true })
  role: Role;









  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop()
  name: string;
}

export const UserSchema = SchemaFactory.createForClass(User);