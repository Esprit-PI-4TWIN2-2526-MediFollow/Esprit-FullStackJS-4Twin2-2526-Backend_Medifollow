import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';

import { User, UserSchema } from '../users/users.schema';
import { Service, ServiceSchema } from '../service/service.schema';
import { DashboardService } from './dashboard.service';
import { Questionnaire, QuestionnaireSchema } from 'src/questionnaires/schemas/questionnaire.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Questionnaire.name, schema: QuestionnaireSchema },
            { name: Service.name, schema: ServiceSchema },
        ]),
    ],
    controllers: [DashboardController],
    providers: [DashboardService],
})
export class DashboardModule { }