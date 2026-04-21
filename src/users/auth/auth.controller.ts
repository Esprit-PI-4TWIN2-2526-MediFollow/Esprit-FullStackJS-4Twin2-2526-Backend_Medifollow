import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthDto, FirstLoginPasswordDto, TwoFactorVerifyDto } from './auth.dto';

@Controller('api')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('signin')
    signIn(@Body() authDto: AuthDto) {
        return this.authService.signIn(authDto);
    }

    @Post('first-login/change-password')
    completeFirstLogin(@Body() dto: FirstLoginPasswordDto) {
        return this.authService.completeFirstLogin(dto);
    }

    @Post('auth/2fa/verify')
    verifyTwoFactor(@Body() dto: TwoFactorVerifyDto) {
        return this.authService.verifyTwoFactor(dto);
    }

}
