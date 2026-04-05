import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CoordinatorController } from './coordinator.controller';
import { CoordinatorService } from './coordinator.service';
import { User, UserSchema } from 'src/users/users.schema';
import { Role, RoleSchema } from 'src/role/schemas/role.schema';
import { Questionnaire, QuestionnaireSchema } from 'src/questionnaires/schemas/questionnaire.schema';
import { QuestionnaireResponse, QuestionnaireResponseSchema } from 'src/questionnaires/schemas/questionnaire-response.schema';
import { Symptom, SymptomSchema } from 'src/symptoms/schemas/symptom.schema';
import { SymptomResponse, SymptomResponseSchema } from 'src/symptoms/schemas/symptom-response.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Questionnaire.name, schema: QuestionnaireSchema },
      { name: QuestionnaireResponse.name, schema: QuestionnaireResponseSchema },
      { name: Symptom.name, schema: SymptomSchema },
      { name: SymptomResponse.name, schema: SymptomResponseSchema },
    ]),
  ],
  controllers: [CoordinatorController],
  providers: [CoordinatorService],
})
export class CoordinatorModule {}
