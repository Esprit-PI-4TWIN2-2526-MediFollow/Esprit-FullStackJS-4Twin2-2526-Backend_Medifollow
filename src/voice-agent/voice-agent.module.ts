import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VoiceAgentController } from './voice-agent.controller';
import { VoiceAgentService } from './voice-agent.service';

@Module({
  imports: [ConfigModule],
  controllers: [VoiceAgentController],
  providers: [VoiceAgentService],
  exports: [VoiceAgentService],
})
export class VoiceAgentModule {}
