import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';

import { User, UserSchema } from '../users/users.schema';
import { Service, ServiceSchema } from '../service/service.schema';
import { DashboardService } from './dashboard.service';
import { Questionnaire, QuestionnaireSchema } from 'src/questionnaires/schemas/questionnaire.schema';
import { QuestionnaireResponse, QuestionnaireResponseSchema } from 'src/questionnaires/schemas/questionnaire-response.schema'; // ✅ AJOUT
import { Role, RoleSchema } from 'src/role/schemas/role.schema';
import { SymptomResponse, SymptomResponseSchema } from 'src/symptoms/schemas/symptom-response.schema';
import { Symptom, SymptomSchema } from 'src/symptoms/schemas/symptom.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name,                  schema: UserSchema },
            { name: Questionnaire.name,         schema: QuestionnaireSchema },
            { name: QuestionnaireResponse.name, schema: QuestionnaireResponseSchema }, // ✅ AJOUT
            { name: Service.name,               schema: ServiceSchema },
            { name: Symptom.name,               schema: SymptomSchema },
            { name: SymptomResponse.name,       schema: SymptomResponseSchema },
            { name: Role.name,                  schema: RoleSchema },
        ]),
    ],
    controllers: [DashboardController],
    providers: [DashboardService],
})
export class DashboardModule {}