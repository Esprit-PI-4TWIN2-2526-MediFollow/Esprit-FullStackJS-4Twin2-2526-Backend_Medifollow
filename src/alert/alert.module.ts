import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { Alert, AlertSchema } from './schemas/alert.schema';
import { AlertsController } from './alerts.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    HttpModule,                                           // Pour appeler FastAPI
    MongooseModule.forFeature([
      { name: Alert.name, schema: AlertSchema },
    ]),
    NotificationsModule,  // For creating notifications
    UsersModule,          // For getting patient info
  ],
  providers: [ AlertsService],
  exports:[AlertsService],
  controllers: [AlertsController]
})
export class AlertModule {}
