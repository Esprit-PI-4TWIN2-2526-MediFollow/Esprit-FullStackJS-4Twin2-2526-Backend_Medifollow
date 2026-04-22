import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { VoiceAgentController } from './voice-agent.controller';
import { VoiceAgentRoleGuard } from './guards/voice-agent-role.guard';
import {
  VoiceCommandLog,
  VoiceCommandLogSchema,
} from './schemas/voice-command-log.schema';
import { VoiceAgentService } from './services/voice-agent.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VoiceCommandLog.name, schema: VoiceCommandLogSchema },
    ]),
  ],
  controllers: [VoiceAgentController],
  providers: [VoiceAgentService, VoiceAgentRoleGuard],
  exports: [VoiceAgentService],
})
export class VoiceAgentModule {}
