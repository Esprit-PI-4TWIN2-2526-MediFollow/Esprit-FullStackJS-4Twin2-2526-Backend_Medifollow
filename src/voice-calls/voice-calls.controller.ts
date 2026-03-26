import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { VoiceCallsService } from './voice-calls.service';
import { StartVoiceCallDto } from './dto/start-voice-call.dto';
import { TwilioVoiceWebhookDto } from './dto/twilio-voice-webhook.dto';

@Controller('voice-calls')
export class VoiceCallsController {
  constructor(private readonly voiceCallsService: VoiceCallsService) {}

  @Post('start')
  async startVoiceCall(@Body() dto: StartVoiceCallDto) {
    return this.voiceCallsService.startCall(dto);
  }

  @Post('twilio/voice')
  handleTwilioVoice(@Res() res: Response) {
    const xml = `<Response>
  <Say>Bonjour, MediFollow fonctionne parfaitement</Say>
</Response>`;

    res.set('Content-Type', 'text/xml');
    return res.send(xml);
  }

  @Post('twilio/gather')
  async handleTwilioGather(
    @Body() dto: TwilioVoiceWebhookDto & Record<string, unknown>,
    @Res() res: Response,
  ) {
    const twiml = await this.voiceCallsService.handleGather(dto);
    res.type('text/xml');
    return res.send(twiml);
  }

  @Post('twilio/status')
  handleTwilioStatus(@Body() body: Record<string, unknown>) {
    console.log('Twilio status webhook:', body);
    return { success: true };
  }
}
