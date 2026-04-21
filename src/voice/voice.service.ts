import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export type VoiceSessionResponse = {
  id: string;
  assistant: {
    name: 'Skander';
  };
  status: 'active';
};

type VapiSessionApiResponse = {
  id?: string;
  [key: string]: unknown;
};

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(private readonly configService: ConfigService) {}

  async createSession(): Promise<VoiceSessionResponse> {
    this.logger.log('Creating VAPI session...');

    const apiKey = this.configService.get<string>('VAPI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('VAPI_API_KEY is missing');
    }

    try {
      const response = await axios.post<VapiSessionApiResponse>(
        'https://api.vapi.ai/session',
        {
          assistant: {
            name: 'Skander',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );

      const sessionId = response.data?.id;
      if (!sessionId) {
        throw new BadGatewayException('Invalid VAPI session response');
      }

      this.logger.log('Session created');

      return {
        id: sessionId,
        assistant: {
          name: 'Skander',
        },
        status: 'active',
      };
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException('Failed to create VAPI session');
    }
  }
}
