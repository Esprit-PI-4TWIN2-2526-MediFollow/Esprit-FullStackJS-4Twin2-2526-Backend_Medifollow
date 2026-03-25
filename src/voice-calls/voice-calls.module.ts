import { Module } from '@nestjs/common';
import { VoiceCallsController } from './voice-calls.controller';
import { VoiceCallsService } from './voice-calls.service';

@Module({
  controllers: [VoiceCallsController],
  providers: [VoiceCallsService]
})
export class VoiceCallsModule {}
