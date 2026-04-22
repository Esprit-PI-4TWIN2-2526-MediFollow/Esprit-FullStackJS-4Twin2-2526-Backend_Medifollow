import {
  BadGatewayException,
  ForbiddenException,
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

export enum VoiceRoleEnum {
  PATIENT = 'patient',
  DOCTOR = 'doctor',
  NURSE = 'nurse',
  ADMIN = 'admin',
}

export type VoiceRole = `${VoiceRoleEnum}`;

export type VoiceAction =
  | 'NAVIGATE'
  | 'FILL_FIELD'
  | 'SUBMIT_FORM'
  | 'GET_PATIENTS'
  | 'GET_ALERTS'
  | 'UNKNOWN';

export type VoiceField =
  | 'temperature'
  | 'heart_rate'
  | 'blood_pressure'
  | 'oxygen'
  | 'pain_level';

export type VoiceTarget = 'dashboard' | 'symptoms' | 'patients';

export type VoiceIntentResponse = {
  action: VoiceAction;
  field?: VoiceField;
  value?: unknown;
  target?: VoiceTarget;
};

type VapiSessionApiResponse = {
  id?: string;
  [key: string]: unknown;
};

type RawIntent = {
  action?: unknown;
  field?: unknown;
  value?: unknown;
  target?: unknown;
};

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

const ALLOWED_ACTIONS = new Set<VoiceAction>([
  'NAVIGATE',
  'FILL_FIELD',
  'SUBMIT_FORM',
  'GET_PATIENTS',
  'GET_ALERTS',
  'UNKNOWN',
]);

const ALLOWED_FIELDS = new Set<VoiceField>([
  'temperature',
  'heart_rate',
  'blood_pressure',
  'oxygen',
  'pain_level',
]);

const ALLOWED_TARGETS = new Set<VoiceTarget>(['dashboard', 'symptoms', 'patients']);

const ROLE_POLICIES: Record<VoiceRole, ReadonlySet<VoiceAction>> = {
  [VoiceRoleEnum.PATIENT]: new Set<VoiceAction>(['NAVIGATE', 'FILL_FIELD', 'SUBMIT_FORM', 'UNKNOWN']),
  [VoiceRoleEnum.NURSE]: new Set<VoiceAction>(['NAVIGATE', 'FILL_FIELD', 'SUBMIT_FORM', 'UNKNOWN']),
  [VoiceRoleEnum.DOCTOR]: new Set<VoiceAction>([
    'NAVIGATE',
    'FILL_FIELD',
    'SUBMIT_FORM',
    'GET_PATIENTS',
    'GET_ALERTS',
    'UNKNOWN',
  ]),
  [VoiceRoleEnum.ADMIN]: new Set<VoiceAction>([
    'NAVIGATE',
    'FILL_FIELD',
    'SUBMIT_FORM',
    'GET_PATIENTS',
    'GET_ALERTS',
    'UNKNOWN',
  ]),
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

  async detectIntent(input: { text: string; role: VoiceRole }): Promise<VoiceIntentResponse> {
    this.logger.log(`Received text: ${input.text}`);
    this.logger.log(`User role: ${input.role}`);

    const rawIntent = await this.extractIntentWithLlm(input.text);
    const normalizedIntent = this.normalizeIntent(rawIntent);

    this.logger.log(`Detected action: ${normalizedIntent.action}`);

    this.ensureRolePermission(input.role, normalizedIntent.action);

    return normalizedIntent;
  }

  private async extractIntentWithLlm(text: string): Promise<RawIntent> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      return { action: 'UNKNOWN' };
    }

    const model = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';

    try {
      const completion = await axios.post<OpenAIChatCompletionResponse>(
        'https://api.openai.com/v1/chat/completions',
        {
          model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are an intent parser for a healthcare voice assistant. English only. ' +
                'Return strict JSON only with keys: action, field, value, target. ' +
                'Allowed action values: NAVIGATE, FILL_FIELD, SUBMIT_FORM, GET_PATIENTS, GET_ALERTS, UNKNOWN. ' +
                'Allowed targets for NAVIGATE: dashboard, symptoms, patients. ' +
                'Allowed fields for FILL_FIELD: temperature, heart_rate, blood_pressure, oxygen, pain_level. ' +
                'For unsupported requests return {"action":"UNKNOWN"}.',
            },
            {
              role: 'user',
              content: text,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        },
      );

      const content = completion.data?.choices?.[0]?.message?.content;
      if (!content) {
        return { action: 'UNKNOWN' };
      }

      const parsed = this.safeParseIntent(content);
      return parsed ?? { action: 'UNKNOWN' };
    } catch {
      return { action: 'UNKNOWN' };
    }
  }

  private normalizeIntent(raw: RawIntent): VoiceIntentResponse {
    const action = this.normalizeAction(raw.action);

    if (action === 'NAVIGATE') {
      const target = this.normalizeTarget(raw.target);
      if (!target) {
        return { action: 'UNKNOWN' };
      }

      return { action, target };
    }

    if (action === 'FILL_FIELD') {
      const field = this.normalizeField(raw.field);
      if (!field) {
        return { action: 'UNKNOWN' };
      }

      return {
        action,
        field,
        value: raw.value,
      };
    }

    if (action === 'SUBMIT_FORM' || action === 'GET_PATIENTS' || action === 'GET_ALERTS') {
      return { action };
    }

    return { action: 'UNKNOWN' };
  }

  private normalizeAction(actionValue: unknown): VoiceAction {
    const normalized = typeof actionValue === 'string' ? actionValue.trim().toUpperCase() : '';
    if (ALLOWED_ACTIONS.has(normalized as VoiceAction)) {
      return normalized as VoiceAction;
    }

    return 'UNKNOWN';
  }

  private normalizeField(fieldValue: unknown): VoiceField | null {
    const normalized = typeof fieldValue === 'string' ? fieldValue.trim().toLowerCase() : '';
    if (ALLOWED_FIELDS.has(normalized as VoiceField)) {
      return normalized as VoiceField;
    }

    return null;
  }

  private normalizeTarget(targetValue: unknown): VoiceTarget | null {
    const normalized = typeof targetValue === 'string' ? targetValue.trim().toLowerCase() : '';
    if (ALLOWED_TARGETS.has(normalized as VoiceTarget)) {
      return normalized as VoiceTarget;
    }

    return null;
  }

  private ensureRolePermission(role: VoiceRole, action: VoiceAction): void {
    const allowedActions = ROLE_POLICIES[role];
    if (!allowedActions.has(action)) {
      throw new ForbiddenException('Unauthorized action');
    }
  }

  private safeParseIntent(content: string): RawIntent | null {
    const trimmed = content.trim();

    try {
      return JSON.parse(trimmed) as RawIntent;
    } catch {
      const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (!fenced?.[1]) {
        return null;
      }

      try {
        return JSON.parse(fenced[1]) as RawIntent;
      } catch {
        return null;
      }
    }
  }
}
