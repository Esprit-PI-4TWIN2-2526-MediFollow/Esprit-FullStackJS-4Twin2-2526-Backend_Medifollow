import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ForgetpasswordModule } from './forgetpassword/forgetpassword.module';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './users.schema';
import { Role, RoleSchema } from 'src/role/schemas/role.schema';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { EmailModule } from './email/email.module';
import { TwoFactorService } from './two-factor.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
    CloudinaryModule, 
    ForgetpasswordModule, 
    EmailModule 
  ],
  controllers: [UsersController],
  providers: [UsersService, TwoFactorService],
  exports: [UsersService, TwoFactorService],
})
export class UsersModule { }
