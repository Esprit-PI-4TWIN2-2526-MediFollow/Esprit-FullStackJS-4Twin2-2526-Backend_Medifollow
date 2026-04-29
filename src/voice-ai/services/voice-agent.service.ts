import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  ProcessVoiceCommandDto,
  VoiceAgentRole,
  VoiceCommandIntent,
} from '../dto/process-voice-command.dto';
import { VoiceCommandResponseDto } from '../dto/voice-command-response.dto';
import {
  VoiceCommandLog,
  VoiceCommandLogDocument,
} from '../schemas/voice-command-log.schema';

type VoiceAgentUserContext = {
  userId: string;
  role: VoiceAgentRole;
};

type AuthorizationResult =
  | {
      allowed: true;
      confirmationRequired: boolean;
    }
  | {
      allowed: false;
      reason: string;
    };

@Injectable()
export class VoiceAgentService {
  private readonly logger = new Logger(VoiceAgentService.name);
  private readonly criticalActionKeywords = ['submit', 'delete', 'cancel'];

  constructor(
    @InjectModel(VoiceCommandLog.name)
    private readonly voiceCommandLogModel: Model<VoiceCommandLogDocument>,
  ) {}

  async processVoiceCommand(
    dto: ProcessVoiceCommandDto,
    user: VoiceAgentUserContext,
  ): Promise<VoiceCommandResponseDto> {
    const normalizedAction = this.normalizeText(dto.action);
    const normalizedTarget = this.normalizeText(dto.target);
    const normalizedTranscript = this.normalizeText(dto.transcript);
    const descriptor = `${normalizedAction} ${normalizedTarget} ${normalizedTranscript}`.trim();

    const authorization = this.authorizeCommand(user.role, dto, descriptor);

    if (!authorization.allowed) {
      const response: VoiceCommandResponseDto = {
        success: false,
        message: 'Unauthorized action',
        intent: dto.intent,
        action: dto.action,
      };

      const denialReason =
        'reason' in authorization ? authorization.reason : 'Unauthorized action';
      await this.logVoiceCommand(dto, user, false, denialReason);
      return response;
    }

    if (authorization.confirmationRequired && !dto.confirmed) {
      const response: VoiceCommandResponseDto = {
        success: false,
        message: 'Confirmation required',
        intent: 'confirm_required',
        action: dto.action,
      };

      await this.logVoiceCommand(dto, user, false, 'Confirmation required for critical action');
      return response;
    }

    const executionData = this.executeAllowedAction(dto, user, descriptor);

    const response: VoiceCommandResponseDto = {
      success: true,
      message: 'Action executed successfully',
      intent: dto.intent,
      action: dto.action,
      data: executionData,
    };

    await this.logVoiceCommand(dto, user, true, 'Executed');
    return response;
  }

  private authorizeCommand(
    role: VoiceAgentRole,
    dto: ProcessVoiceCommandDto,
    descriptor: string,
  ): AuthorizationResult {
    const confirmationRequired = this.isCriticalAction(dto.action);

    if (role === VoiceAgentRole.ADMIN) {
      return { allowed: true, confirmationRequired };
    }

    switch (role) {
      case VoiceAgentRole.PATIENT:
        return this.authorizePatient(dto, descriptor, confirmationRequired);
      case VoiceAgentRole.DOCTOR:
        return this.authorizeDoctor(dto, descriptor, confirmationRequired);
      case VoiceAgentRole.NURSE:
        return this.authorizeNurse(dto, descriptor, confirmationRequired);
      case VoiceAgentRole.LAB_TECH:
        return this.authorizeLabTech(dto, descriptor, confirmationRequired);
      case VoiceAgentRole.INSURANCE:
        return this.authorizeInsurance(dto, descriptor, confirmationRequired);
      default:
        return { allowed: false, reason: 'Role is not allowed for voice operations' };
    }
  }

  private authorizePatient(
    dto: ProcessVoiceCommandDto,
    descriptor: string,
    confirmationRequired: boolean,
  ): AuthorizationResult {
    if (this.hasAnyKeyword(descriptor, ['admin', 'delete', 'remove', 'user', 'report', 'all patients'])) {
      return { allowed: false, reason: 'Patient attempted restricted domain action' };
    }

    if (dto.intent === VoiceCommandIntent.FILL_FIELD && this.hasAnyKeyword(descriptor, ['symptom'])) {
      return { allowed: true, confirmationRequired };
    }

    if (dto.intent === VoiceCommandIntent.FORM_ACTION && this.hasAnyKeyword(descriptor, ['submit'])) {
      return { allowed: true, confirmationRequired };
    }

    if (dto.intent === VoiceCommandIntent.NAVIGATE || dto.intent === VoiceCommandIntent.READ_QUESTION) {
      return { allowed: true, confirmationRequired };
    }

    return { allowed: false, reason: 'Patient intent/action combination is not permitted' };
  }

  private authorizeDoctor(
    dto: ProcessVoiceCommandDto,
    descriptor: string,
    confirmationRequired: boolean,
  ): AuthorizationResult {
    if (this.hasAnyKeyword(descriptor, ['delete user', 'remove user', 'delete users'])) {
      return { allowed: false, reason: 'Doctor attempted restricted user deletion action' };
    }

    if (
      dto.intent === VoiceCommandIntent.FETCH_DATA &&
      this.hasAnyKeyword(descriptor, ['patient', 'patients', 'report', 'reports'])
    ) {
      return { allowed: true, confirmationRequired };
    }

    if (dto.intent === VoiceCommandIntent.READ_QUESTION || dto.intent === VoiceCommandIntent.NAVIGATE) {
      return { allowed: true, confirmationRequired };
    }

    return { allowed: false, reason: 'Doctor intent/action combination is not permitted' };
  }

  private authorizeNurse(
    dto: ProcessVoiceCommandDto,
    descriptor: string,
    confirmationRequired: boolean,
  ): AuthorizationResult {
    if (this.hasAnyKeyword(descriptor, ['admin', 'delete user', 'insurance policy'])) {
      return { allowed: false, reason: 'Nurse attempted restricted action' };
    }

    if (
      (dto.intent === VoiceCommandIntent.FILL_FIELD && this.hasAnyKeyword(descriptor, ['symptom', 'vital'])) ||
      (dto.intent === VoiceCommandIntent.FETCH_DATA && this.hasAnyKeyword(descriptor, ['patient', 'ward', 'vital'])) ||
      dto.intent === VoiceCommandIntent.READ_QUESTION ||
      dto.intent === VoiceCommandIntent.NAVIGATE
    ) {
      return { allowed: true, confirmationRequired };
    }

    return { allowed: false, reason: 'Nurse intent/action combination is not permitted' };
  }

  private authorizeLabTech(
    dto: ProcessVoiceCommandDto,
    descriptor: string,
    confirmationRequired: boolean,
  ): AuthorizationResult {
    if (this.hasAnyKeyword(descriptor, ['admin', 'delete user', 'insurance'])) {
      return { allowed: false, reason: 'Lab technician attempted restricted action' };
    }

    if (
      (dto.intent === VoiceCommandIntent.FETCH_DATA && this.hasAnyKeyword(descriptor, ['lab', 'test', 'result'])) ||
      (dto.intent === VoiceCommandIntent.FORM_ACTION && this.hasAnyKeyword(descriptor, ['submit'])) ||
      dto.intent === VoiceCommandIntent.READ_QUESTION ||
      dto.intent === VoiceCommandIntent.NAVIGATE
    ) {
      return { allowed: true, confirmationRequired };
    }

    return { allowed: false, reason: 'Lab technician intent/action combination is not permitted' };
  }

  private authorizeInsurance(
    dto: ProcessVoiceCommandDto,
    descriptor: string,
    confirmationRequired: boolean,
  ): AuthorizationResult {
    if (this.hasAnyKeyword(descriptor, ['admin', 'delete user', 'medical report full'])) {
      return { allowed: false, reason: 'Insurance role attempted restricted action' };
    }

    if (
      (dto.intent === VoiceCommandIntent.FETCH_DATA && this.hasAnyKeyword(descriptor, ['claim', 'coverage', 'policy'])) ||
      (dto.intent === VoiceCommandIntent.FORM_ACTION && this.hasAnyKeyword(descriptor, ['submit', 'approve', 'reject'])) ||
      dto.intent === VoiceCommandIntent.READ_QUESTION ||
      dto.intent === VoiceCommandIntent.NAVIGATE
    ) {
      return { allowed: true, confirmationRequired };
    }

    return { allowed: false, reason: 'Insurance intent/action combination is not permitted' };
  }

  private executeAllowedAction(
    dto: ProcessVoiceCommandDto,
    user: VoiceAgentUserContext,
    descriptor: string,
  ): Record<string, unknown> {
    return {
      executedAt: new Date().toISOString(),
      userId: user.userId,
      role: user.role,
      intent: dto.intent,
      action: dto.action,
      target: dto.target ?? null,
      commandFingerprint: this.hashDescriptor(descriptor),
      status: 'executed',
    };
  }

  private async logVoiceCommand(
    dto: ProcessVoiceCommandDto,
    user: VoiceAgentUserContext,
    success: boolean,
    message: string,
  ): Promise<void> {
    try {
      await this.voiceCommandLogModel.create({
        userId: user.userId,
        role: user.role,
        intent: dto.intent,
        action: dto.action,
        timestamp: new Date(),
        success,
        message,
      } as VoiceCommandLog);
    } catch (error) {
      this.logger.error(
        'Failed to persist voice command log',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private normalizeText(value?: string): string {
    return (value ?? '').trim().toLowerCase();
  }

  private isCriticalAction(action: string): boolean {
    const normalized = this.normalizeText(action);
    return this.criticalActionKeywords.some((keyword) => normalized.includes(keyword));
  }

  private hasAnyKeyword(value: string, keywords: string[]): boolean {
    return keywords.some((keyword) => value.includes(keyword));
  }

  private hashDescriptor(input: string): string {
    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
      hash = (hash << 5) - hash + input.charCodeAt(index);
      hash |= 0;
    }
    return `vcmd_${Math.abs(hash)}`;
  }
}
