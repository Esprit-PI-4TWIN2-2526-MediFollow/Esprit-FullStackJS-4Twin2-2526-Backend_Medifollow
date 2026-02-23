import { Module } from '@nestjs/common';
import { ForgetpasswordService } from './forgetpassword.service';
import { ForgetpasswordController } from './forgetpassword.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users.schema';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ForgetpasswordController],
  providers: [ForgetpasswordService],
})
export class ForgetpasswordModule {}