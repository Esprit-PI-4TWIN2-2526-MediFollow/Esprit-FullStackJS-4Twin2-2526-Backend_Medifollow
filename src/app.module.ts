import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { RoleModule } from './role/role.module';
import { AuthModule } from './users/auth/auth.module';
import { SecurityMiddleware } from './middleware/security.middleware';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailModule } from './users/email/email.module';
import { WebauthnModule } from './webauthn/webauthn.module';
import { FaceRecognitionModule } from './face-recognition/face-recognition.module';
import { QuestionnaireModule } from './questionnaires/questionnaires.module';
import { AiModule } from './ai/ai.module';
import { ServiceModule } from './service/service.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SymptomsModule } from './symptoms/symptoms.module';
import { CoordinatorModule } from './coordinator/coordinator.module';
import { VoiceCallsModule } from './voice-calls/voice-calls.module';
import { AlertModule } from './alert/alert.module';
import { AiAnalysisModule } from './ai-analysis/ai-analysis.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { ChatModule } from './communication/chat.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
        dbName: config.get<string>('MONGODB_NAME'),

      }),
      inject: [ConfigService],
      
    }),
    //DatabaseModule,
    UsersModule,
    AuthModule,
    EmailModule,
    RoleModule,
    CloudinaryModule,
    WebauthnModule,
    FaceRecognitionModule,
    QuestionnaireModule,
    AiModule,
    ServiceModule,
    DashboardModule,
    SymptomsModule,
    CoordinatorModule,
    VoiceCallsModule,
    AlertModule,

    AiAnalysisModule,

    ChatModule

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityMiddleware)
      .forRoutes('*');
  }
}
