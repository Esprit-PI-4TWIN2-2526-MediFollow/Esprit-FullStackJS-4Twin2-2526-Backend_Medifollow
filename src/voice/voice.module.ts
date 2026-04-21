import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';

@Module({
  imports: [ConfigModule],
  controllers: [VoiceController],
  providers: [VoiceService],
  exports: [VoiceService],
})
export class VoiceModule {}
