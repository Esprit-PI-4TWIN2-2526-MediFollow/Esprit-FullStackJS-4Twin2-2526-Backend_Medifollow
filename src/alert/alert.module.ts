import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { Alert, AlertSchema } from './schemas/alert.schema';
import { AlertsController } from './alerts.controller';

@Module({
  imports: [
    HttpModule,                                           // Pour appeler FastAPI
    MongooseModule.forFeature([
      { name: Alert.name, schema: AlertSchema },
    ]),
  ],
  providers: [ AlertsService],
  exports:[AlertsService],
  controllers: [AlertsController]
})
export class AlertModule {}
