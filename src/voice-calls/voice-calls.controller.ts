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
  <Gather numDigits="1" method="POST" action="/voice-calls/twilio/handle-response">
    <Say>Bonjour. Veuillez entrer votre température. Si elle est entre 35 et 36 appuyez sur 1. Si elle est entre 36 et 37 appuyez sur 2.</Say>
  </Gather>
  <Say>Nous n'avons pas reçu de réponse.</Say>
</Response>`;

    res.set('Content-Type', 'text/xml');
    return res.send(xml);
  }

  @Post('twilio/handle-response')
  handleTwilioResponse(@Body() body: Record<string, unknown>, @Res() res: Response) {
    const digits = typeof body.Digits === 'string' ? body.Digits : '';
    console.log('Twilio digits:', digits);

    let message = 'Choix invalide';
    if (digits === '1') {
      message = 'Température basse enregistrée';
    } else if (digits === '2') {
      message = 'Température normale enregistrée';
    }

    const xml = `<Response>
  <Say>${message}</Say>
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
