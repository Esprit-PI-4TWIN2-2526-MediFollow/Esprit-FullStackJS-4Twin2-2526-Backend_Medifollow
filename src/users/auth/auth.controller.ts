import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthDto } from './auth.dto';
import { JwtAuthGuard } from './jwt.guard';
import { RolesGuard } from 'src/role/guard/role.guard';

@Controller('api')

export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('signin')
    signIn(@Body() authDto: AuthDto) {
        return this.authService.signIn(authDto);
    }

}
