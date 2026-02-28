import { Controller, Post, Get, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { WebauthnService } from './webauthn.service';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';

@Controller('api/webauthn')
export class WebauthnController {
  constructor(private readonly webauthnService: WebauthnService) {}

  // Registration endpoints
  @Post('register/options')
  async getRegistrationOptions(@Body('userId') userId: string) {
    return this.webauthnService.generateRegistrationOptions(userId);
  }

  @Post('register/verify')
  async verifyRegistration(
    @Body('userId') userId: string,
    @Body('response') response: RegistrationResponseJSON,
  ) {
    return this.webauthnService.verifyRegistration(userId, response);
  }

  // Authentication endpoints
  @Post('authenticate/options')
  async getAuthenticationOptions(@Body('email') email: string) {
    return this.webauthnService.generateAuthenticationOptions(email);
  }

  @Post('authenticate/verify')
  async verifyAuthentication(
    @Body('email') email: string,
    @Body('response') response: AuthenticationResponseJSON,
  ) {
    return this.webauthnService.verifyAuthentication(email, response);
  }

  // Get user's authenticators
  @Get('authenticators/:userId')
  async getUserAuthenticators(@Param('userId') userId: string) {
    return this.webauthnService.getUserAuthenticators(userId);
  }

  // Delete authenticator
  @Delete('authenticators/:userId/:authenticatorId')
  async deleteAuthenticator(
    @Param('userId') userId: string,
    @Param('authenticatorId') authenticatorId: string,
  ) {
    return this.webauthnService.deleteAuthenticator(userId, authenticatorId);
  }
}
