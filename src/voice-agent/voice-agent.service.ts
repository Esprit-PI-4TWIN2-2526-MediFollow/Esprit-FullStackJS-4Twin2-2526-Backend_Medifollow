import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type VapiSessionResponse = {
  id?: string;
  [key: string]: unknown;
};

@Injectable()
export class VoiceAgentService {
  private readonly logger = new Logger(VoiceAgentService.name);

  constructor(private readonly configService: ConfigService) {}

  async createSession(): Promise<VapiSessionResponse> {
    const apiKey = this.configService.get<string>('VAPI_API_KEY');

    console.log('Using VAPI KEY:', apiKey ? 'OK' : 'MISSING');

    if (!apiKey) {
      throw new InternalServerErrorException('VAPI_API_KEY is missing');
    }

    const response = await fetch('https://api.vapi.ai/session', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistant: {
          name: 'Skander',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Failed to create Vapi session: ${response.status} ${errorText}`);
      throw new InternalServerErrorException('Failed to create Vapi session');
    }

    return (await response.json()) as VapiSessionResponse;
  }
}
