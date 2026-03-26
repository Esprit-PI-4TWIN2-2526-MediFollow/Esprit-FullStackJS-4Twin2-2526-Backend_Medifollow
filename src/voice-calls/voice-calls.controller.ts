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

  @Post('call')
  async triggerCall(@Body() body: { phoneNumber?: string }) {
    const phoneNumber = typeof body?.phoneNumber === 'string' ? body.phoneNumber : '';

    await this.voiceCallsService.makeCall(phoneNumber);

    return { message: 'Call triggered successfully' };
  }

  @Post('twilio/voice')
  async handleTwilioVoice(
    @Body() body: TwilioVoiceWebhookDto & Record<string, unknown>,
    @Res() res: Response,
  ) {
    const xml = await this.voiceCallsService.handleIncomingVoice(body);
    res.set('Content-Type', 'text/xml');
    return res.send(xml);
  }

  @Post('twilio/handle-response')
  async handleTwilioResponse(
    @Body() body: TwilioVoiceWebhookDto & Record<string, unknown>,
    @Res() res: Response,
  ) {
    const xml = await this.voiceCallsService.handleVoiceResponse(body);
    res.set('Content-Type', 'text/xml');
    return res.send(xml);
  }

  @Post('twilio/gather')
  async handleTwilioGather(
    @Body() body: TwilioVoiceWebhookDto & Record<string, unknown>,
    @Res() res: Response,
  ) {
    const xml = await this.voiceCallsService.handleVoiceResponse(body);
    res.set('Content-Type', 'text/xml');
    return res.send(xml);
  }

  @Post('twilio/status')
  handleTwilioStatus(@Body() body: Record<string, unknown>) {
    console.log('Twilio status webhook:', body);
    return { success: true };
  }
}
