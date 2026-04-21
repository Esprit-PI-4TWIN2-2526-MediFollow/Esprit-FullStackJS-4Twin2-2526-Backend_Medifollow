import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TranslationDocument = Translation & Document;

@Schema({ timestamps: true })
export class Translation {
  @Prop({ required: true, index: true })
  key: string; // hash MD5 du texte source + lang source

  @Prop({ required: true })
  sourceText: string;

  @Prop({ required: true })
  sourceLang: string;

  @Prop({
    type: Map,
    of: String,
  })
  translations: Map<string, string>; 

  @Prop({ default: 'google' })
  provider: string; 
}

export const TranslationSchema = SchemaFactory.createForClass(Translation);
// Index composé pour recherche rapide
TranslationSchema.index({ key: 1, sourceLang: 1 });