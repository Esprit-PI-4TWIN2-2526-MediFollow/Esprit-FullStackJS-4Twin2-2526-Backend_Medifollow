import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Questionnaire, QuestionnaireSchema } from './schemas/questionnaire.schema';
import { QuestionnaireResponse, QuestionnaireResponseSchema } from './schemas/questionnaire-response.schema';
import { QuestionnaireController } from './questionnaire.controller';
import { QuestionnaireService } from './questionnaire.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Questionnaire.name, schema: QuestionnaireSchema },
      { name: QuestionnaireResponse.name, schema: QuestionnaireResponseSchema },
    ]),
  ],
  controllers: [QuestionnaireController],
  providers: [QuestionnaireService],
  exports: [QuestionnaireService],
})
export class QuestionnaireModule {}