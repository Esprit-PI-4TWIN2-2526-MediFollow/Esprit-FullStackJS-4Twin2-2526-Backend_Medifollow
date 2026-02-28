import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FaceRecognitionController } from './face-recognition.controller';
import { FaceRecognitionService } from './face-recognition.service';
import { User, UserSchema } from '../users/users.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<number>('JWT_EXPIRES_IN'),
        },
      }),
    }),
  ],
  controllers: [FaceRecognitionController],
  providers: [FaceRecognitionService],
})
export class FaceRecognitionModule {}
