import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Questionnaire, QuestionnaireSchema } from './schemas/questionnaire.schema';
import { QuestionnaireResponse, QuestionnaireResponseSchema } from './schemas/questionnaire-response.schema';
import { QuestionnaireController } from './questionnaire.controller';
import { QuestionnaireService } from './questionnaire.service';
import { HttpModule } from '@nestjs/axios';
import { Alert, AlertSchema } from 'src/alert/schemas/alert.schema';

@Module({
  imports: [
    HttpModule, //pour appeler fastapi
    MongooseModule.forFeature([
      { name: Questionnaire.name, schema: QuestionnaireSchema },
      { name: QuestionnaireResponse.name, schema: QuestionnaireResponseSchema },
      
    ]),
    
  ],
  controllers: [QuestionnaireController],
  providers: [QuestionnaireService],
  exports: [QuestionnaireService], // Pour pouvoir l'utiliser dans d'autres modules
})
export class QuestionnaireModule {}