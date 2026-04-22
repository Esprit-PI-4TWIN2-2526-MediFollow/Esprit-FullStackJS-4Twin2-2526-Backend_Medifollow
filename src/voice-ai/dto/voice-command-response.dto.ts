import { VoiceCommandIntent } from './process-voice-command.dto';

export class VoiceCommandResponseDto {
  success: boolean;
  message: string;
  intent: VoiceCommandIntent | 'confirm_required';
  action?: string;
  data?: Record<string, unknown>;
}
