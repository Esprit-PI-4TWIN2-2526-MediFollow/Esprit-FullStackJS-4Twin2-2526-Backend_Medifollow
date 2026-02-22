import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';
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

@Prop({ required: true })
dateNaissance: Date;

@Prop({ required: true })
sexe: string;

@Prop({ default: true })
actif: boolean;

@Prop({ type: Types.ObjectId, ref: Role.name, required: true })
role: Types.ObjectId | Role;

@Prop({ required: true, unique: true })
email: string;

@Prop({ required: true })
password: string;

@Prop()
specialite?: string;

@Prop()
diplome?: string;

@Prop()
grade?: string;

}

export const UserSchema = SchemaFactory.createForClass(User);
