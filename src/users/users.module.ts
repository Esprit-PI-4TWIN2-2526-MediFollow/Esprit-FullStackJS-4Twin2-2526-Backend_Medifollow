import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ForgetpasswordModule } from './forgetpassword/forgetpassword.module';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  imports: [ForgetpasswordModule]
})
export class UsersModule {}
