import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { I18nController } from './i18n.controller';
import { I18nService } from './i18n.service';
import { Translation, TranslationSchema } from './schema/translation.schema';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Translation.name, schema: TranslationSchema },
    ]),
  ],
  controllers: [I18nController],
  providers: [I18nService],
  exports: [I18nService], // ← exporté pour utilisation dans d'autres modules
})
export class I18nModule {}