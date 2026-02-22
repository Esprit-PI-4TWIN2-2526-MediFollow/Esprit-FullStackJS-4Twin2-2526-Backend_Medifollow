import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthDto } from './auth.dto';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('signin')
    signIn(@Body() authDto: AuthDto) {
        return this.authService.signIn(authDto);
    }
    @Post('signup')
  signUp(@Body() signUpDto: any) {
    return this.authService.signUp(signUpDto);
  }
}
