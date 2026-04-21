import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';
import { AuditorService } from './auditor.service';
import { AuditorController } from './auditor.controller';
import { AuditorInterceptor } from './auditor.interceptor';
import { User, UserSchema } from 'src/users/users.schema';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [
    AuditorService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditorInterceptor,
    },
  ],
  controllers: [AuditorController],
  exports: [AuditorService],
})
export class AuditorModule {}
