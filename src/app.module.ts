import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
    UsersModule,
    AuthModule,
    EmailModule,
    RoleModule,
    CloudinaryModule,
    WebauthnModule,
    FaceRecognitionModule,
    QuestionnaireModule,
    AiModule,
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