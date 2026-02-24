import { Controller, Post, Body, Param } from '@nestjs/common';
import { ForgetpasswordService } from './forgetpassword.service';

@Controller('users/forgetpassword')
export class ForgetpasswordController {
  constructor(private readonly service: ForgetpasswordService) {}

  @Post()
  forgot(@Body('email') email: string) {
    return this.service.forgotPassword(email);
  }

  @Post('reset/:token')
  reset(
    @Param('token') token: string,
    @Body('password') password: string,
  ) {
    return this.service.resetPassword(token, password);
  }
}