import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { Message, MessageSchema } from './schemas/message.schema';
import { UsersModule } from 'src/users/users.module';
import { WsJwtGuard } from './ws-jwt.guard';
import { ChatGateway } from './chat.gatway';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { ChatController } from './chat.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    ConfigModule,
    UsersModule,
    CloudinaryModule,
  ],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService, WsJwtGuard],
})
export class ChatModule {}
