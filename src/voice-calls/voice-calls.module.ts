import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VoiceCallsController } from './voice-calls.controller';
import { VoiceCallsService } from './voice-calls.service';
import {
  VoiceCallSession,
  VoiceCallSessionSchema,
} from './schemas/voice-call-session.schema';
import { SymptomsModule } from 'src/symptoms/symptoms.module';
import { User, UserSchema } from 'src/users/users.schema';

@Module({
  imports: [
    SymptomsModule,
    MongooseModule.forFeature([
      { name: VoiceCallSession.name, schema: VoiceCallSessionSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [VoiceCallsController],
  providers: [VoiceCallsService],
  exports: [VoiceCallsService],
})
export class VoiceCallsModule {}
