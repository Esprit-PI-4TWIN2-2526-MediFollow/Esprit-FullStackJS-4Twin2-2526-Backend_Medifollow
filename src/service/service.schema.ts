import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ServiceDocument = Service & Document;

@Schema({ timestamps: true })
export class Service {

  @Prop({ required: true })
  nom: string;

  @Prop()
  description: string;

  @Prop()
  localisation: string;

  @Prop()
  type: string;

  @Prop()
  telephone: string;

  @Prop()
  email: string;

  @Prop()
  capacite: number;

  @Prop({ enum: ['ACTIF', 'INACTIF'], default: 'ACTIF' })
  statut: string;

  @Prop()
  tempsAttenteMoyen: number;

  @Prop({ default: false })
  estUrgence: boolean;

  @Prop([
    {
      jour: String,
      ouverture: String,
      fermeture: String,
    },
  ])
  horaires: {
    jour: string;
    ouverture: string;
    fermeture: string;
  }[];

  @Prop()
  responsableId: string;

  @Prop()
  deletedAt?: Date;
}

export const ServiceSchema = SchemaFactory.createForClass(Service);
