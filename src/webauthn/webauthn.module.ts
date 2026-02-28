import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WebauthnController } from './webauthn.controller';
import { WebauthnService } from './webauthn.service';
import { Authenticator, AuthenticatorSchema } from './schemas/authenticator.schema';
import { User, UserSchema } from '../users/users.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Authenticator.name, schema: AuthenticatorSchema },
      { name: User.name, schema: UserSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService): Promise<JwtModuleOptions> => ({
        secret: configService.get<string>('JWT_SECRET') || 'default_secret',
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') || '24h') as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [WebauthnController],
  providers: [WebauthnService],
  exports: [WebauthnService],
})
export class WebauthnModule {}
