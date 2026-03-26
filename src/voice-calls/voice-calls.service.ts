import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Twilio from 'twilio';
import {
  VoiceCallSession,
  VoiceCallSessionDocument,
} from './schemas/voice-call-session.schema';
import { SymptomsService } from 'src/symptoms/symptoms.service';
import { User, UserDocument } from 'src/users/users.schema';
import { StartVoiceCallDto } from './dto/start-voice-call.dto';
import { TwilioVoiceWebhookDto } from './dto/twilio-voice-webhook.dto';

type CreateVoiceCallSessionInput = {
  callSid: string;
  patientId: string;
  formId: string;
  phoneNumber: string;
  currentQuestionIndex?: number;
  status?: 'initiated' | 'in_progress' | 'completed' | 'failed';
  channel?: string;
  provider?: string;
  startedAt?: Date;
  completedAt?: Date | null;
  lastWebhookAt?: Date | null;
};

type SaveVoiceResponseInput = {
  phoneNumber: string;
  question: string;
  value: string | number;
  source: string;
  createdAt: Date;
};

type SymptomQuestionLike = {
  _id?: { toString(): string } | string;
  label: string;
  type: string;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
  };
};

type SymptomFormLike = {
  _id?: { toString(): string } | string;
  title?: string;
  questions?: SymptomQuestionLike[];
};

const INVALID_MARKER = '__invalid__';

@Injectable()
export class VoiceCallsService {
  constructor(
    @InjectModel(VoiceCallSession.name)
    private readonly voiceCallSessionModel: Model<VoiceCallSessionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly symptomsService: SymptomsService,
    private readonly configService: ConfigService,
  ) {}

  async createSession(data: CreateVoiceCallSessionInput): Promise<VoiceCallSession> {
    return this.voiceCallSessionModel.create({
      ...data,
      currentQuestionIndex: data.currentQuestionIndex ?? 0,
      status: data.status ?? 'initiated',
      channel: data.channel ?? 'voice-call',
      provider: data.provider ?? 'twilio',
      startedAt: data.startedAt ?? new Date(),
    });
  }

  async findByCallSid(callSid: string): Promise<VoiceCallSessionDocument> {
    const session = await this.voiceCallSessionModel.findOne({ callSid }).exec();

    if (!session) {
      throw new NotFoundException(`Voice call session ${callSid} not found`);
    }

    return session;
  }

  async saveAnswer(
    callSid: string,
    questionId: string,
    digits: string,
    mappedValue: string | null,
  ): Promise<VoiceCallSession> {
    const session = await this.findByCallSid(callSid);

    session.answers.push({
      questionId,
      rawDigits: digits,
      mappedValue,
      answeredAt: new Date(),
    });
    session.currentQuestionIndex += 1;
    session.status = 'in_progress';
    session.lastWebhookAt = new Date();

    await session.save();

    return session;
  }

  async completeSession(callSid: string): Promise<VoiceCallSession> {
    const session = await this.findByCallSid(callSid);

    session.status = 'completed';
    session.completedAt = new Date();
    session.lastWebhookAt = new Date();

    await session.save();

    return session;
  }

  async failSession(callSid: string): Promise<VoiceCallSession> {
    const session = await this.findByCallSid(callSid);

    session.status = 'failed';
    session.lastWebhookAt = new Date();

    await session.save();

    return session;
  }

  async startCall(dto: StartVoiceCallDto) {
    const patient = await this.resolvePatient(dto);
    const phoneNumber = dto.phoneNumber?.trim() || patient.phoneNumber?.trim();

    if (!phoneNumber) {
      throw new BadRequestException('Patient phone number is required');
    }

    const form = await this.loadAssignedForm(patient._id.toString());
    const formId = this.getFormId(form);
    const voiceUrl = this.buildAbsoluteUrl('/voice-calls/twilio/voice');
    const statusUrl = this.buildAbsoluteUrl('/voice-calls/twilio/status');

    const twilioCall = await this.createTwilioCall(phoneNumber, voiceUrl, statusUrl);

    const session = await this.createSession({
      callSid: twilioCall.sid,
      patientId: patient._id.toString(),
      formId,
      phoneNumber,
      status: 'initiated',
      lastWebhookAt: null,
    });

    return {
      message: 'Voice call started',
      callSid: twilioCall.sid,
      patientId: session.patientId,
      formId: session.formId,
      status: session.status,
    };
  }

  async saveVoiceResponse(data: SaveVoiceResponseInput) {
    const digits = this.extractString(data.value);
    const phone = this.extractString(data.phoneNumber);

    let temperature: number | null = null;

    if (digits === '1') {
      temperature = 35.5;
    }

    if (digits === '2') {
      temperature = 36.5;
    }

    const session = new this.voiceCallSessionModel({
      phoneNumber: phone,
      digits,
      interpretedValue: temperature,
      startedAt: data.createdAt,
      lastWebhookAt: data.createdAt,
      channel: 'voice',
      provider: 'twilio',
      status: 'completed',
    });

    await session.save();

    console.log('Saved voice response:', session);

    return session;
  }

  async makeCall(phoneNumber: string) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const from = this.configService.get<string>('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !from) {
      throw new Error('Twilio credentials are not configured');
    }

    if (!phoneNumber?.trim()) {
      throw new BadRequestException('phoneNumber is required');
    }

    const client = Twilio(accountSid, authToken);

    await client.calls.create({
      to: phoneNumber,
      from,
      url: 'https://unretiring-georgiann-unfostering.ngrok-free.dev/voice-calls/twilio/voice',
    });
  }

  async buildVoiceResponse(callSid: string): Promise<string> {
    const session = await this.findByCallSid(callSid);
    session.lastWebhookAt = new Date();
    if (session.status === 'initiated') {
      session.status = 'in_progress';
    }
    await session.save();

    if (!session.patientId) {
      throw new InternalServerErrorException('Voice call session patientId is missing');
    }

    const form = await this.loadAssignedForm(session.patientId);
    const question = this.getCurrentQuestion(session, form);

    if (!question) {
      await this.completeAndPersistSession(session, form);
      return this.buildCompletionTwiml();
    }

    return this.buildQuestionTwiml(question, session.currentQuestionIndex === 0);
  }

  async handleGather(dto: TwilioVoiceWebhookDto & Record<string, unknown>): Promise<string> {
    const callSid = this.extractString(dto.CallSid);
    const digits = this.extractString(dto.Digits);

    if (!callSid) {
      throw new BadRequestException('CallSid is required');
    }

    const session = await this.findByCallSid(callSid);
    session.lastWebhookAt = new Date();

    if (!session.patientId) {
      throw new InternalServerErrorException('Voice call session patientId is missing');
    }

    const form = await this.loadAssignedForm(session.patientId);
    const question = this.getCurrentQuestion(session, form);

    if (!question) {
      await this.completeAndPersistSession(session, form);
      return this.buildCompletionTwiml();
    }

    if (!digits) {
      return this.handleInvalidInput(session, question, 'No digits received');
    }

    const duplicateHandled = this.handleDuplicateGather(session, form, digits);
    if (duplicateHandled) {
      return duplicateHandled;
    }

    const mappedValue = this.mapDigitsToAnswer(question, digits);
    if (mappedValue === INVALID_MARKER) {
      return this.handleInvalidInput(session, question, digits);
    }

    await this.saveAnswer(
      callSid,
      this.getQuestionId(question),
      digits,
      this.stringifyMappedValue(mappedValue),
    );

    const nextQuestion = this.getCurrentQuestion(await this.findByCallSid(callSid), form);
    if (!nextQuestion) {
      await this.completeAndPersistSession(await this.findByCallSid(callSid), form);
      return this.buildCompletionTwiml();
    }

    return this.buildQuestionTwiml(nextQuestion, false);
  }

  async handleStatus(dto: TwilioVoiceWebhookDto & Record<string, unknown>) {
    const callSid = this.extractString(dto.CallSid);
    if (!callSid) {
      throw new BadRequestException('CallSid is required');
    }

    const session = await this.findByCallSid(callSid);
    session.lastWebhookAt = new Date();

    const rawStatus = this.extractString((dto as Record<string, unknown>)['CallStatus']);
    const normalizedStatus = rawStatus.toLowerCase();

    if (['completed'].includes(normalizedStatus)) {
      session.status = 'completed';
      session.completedAt = session.completedAt ?? new Date();
    } else if (['failed', 'busy', 'no-answer', 'canceled'].includes(normalizedStatus)) {
      session.status = 'failed';
    }

    await session.save();

    return {
      message: 'Voice call status updated',
      callSid: session.callSid,
      status: session.status,
    };
  }

  private async resolvePatient(dto: StartVoiceCallDto): Promise<UserDocument> {
    const patientId = dto.patientId?.trim();
    const phoneNumber = dto.phoneNumber?.trim();

    if (!patientId && !phoneNumber) {
      throw new BadRequestException('patientId or phoneNumber is required');
    }

    const patient = patientId
      ? await this.userModel.findById(patientId).exec()
      : await this.userModel.findOne({ phoneNumber }).exec();

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return patient;
  }

  private async loadAssignedForm(patientId: string): Promise<SymptomFormLike> {
    const form = await this.symptomsService.findFormByPatient(patientId);
    return form as SymptomFormLike;
  }

  private getFormId(form: SymptomFormLike): string {
    const formId = form?._id?.toString?.() ?? `${form?._id ?? ''}`;
    if (!formId) {
      throw new InternalServerErrorException('Assigned symptom form id is missing');
    }

    return formId;
  }

  private getCurrentQuestion(
    session: VoiceCallSessionDocument,
    form: SymptomFormLike,
  ): SymptomQuestionLike | null {
    const questions = Array.isArray(form.questions) ? form.questions : [];
    return questions[session.currentQuestionIndex] ?? null;
  }

  private getQuestionId(question: SymptomQuestionLike): string {
    const questionId = question?._id?.toString?.() ?? `${question?._id ?? ''}`;
    if (!questionId) {
      throw new InternalServerErrorException('Question id is missing');
    }

    return questionId;
  }

  private async createTwilioCall(to: string, voiceUrl: string, statusUrl: string) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const from = this.configService.get<string>('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !from) {
      throw new Error('Twilio credentials are not configured');
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: to,
          From: from,
          Url: voiceUrl,
          StatusCallback: statusUrl,
          StatusCallbackMethod: 'POST',
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new InternalServerErrorException(`Twilio call creation failed: ${errorBody}`);
    }

    return (await response.json()) as { sid: string };
  }

  private buildAbsoluteUrl(path: string): string {
    const baseUrl =
      this.configService.get<string>('PUBLIC_BASE_URL') ||
      this.configService.get<string>('API_BASE_URL') ||
      this.configService.get<string>('APP_BASE_URL');

    if (!baseUrl) {
      throw new InternalServerErrorException('Base URL is not configured for Twilio callbacks');
    }

    return `${baseUrl.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private buildQuestionTwiml(question: SymptomQuestionLike, includeGreeting: boolean): string {
    const prompt = this.buildQuestionPrompt(question);
    const gatherAttributes = this.buildGatherAttributes(question);
    const gatherAction = this.buildAbsoluteUrl('/voice-calls/twilio/gather');

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      includeGreeting ? `<Say>${this.escapeXml('Bonjour. This is your MediFollow symptom follow-up call.')}</Say>` : '',
      `<Gather input="dtmf" action="${this.escapeXml(gatherAction)}" method="POST"${gatherAttributes}>`,
      `<Say>${this.escapeXml(prompt)}</Say>`,
      '</Gather>',
      `<Say>${this.escapeXml('We did not receive your response. Please try again.')}</Say>`,
      `<Redirect method="POST">${this.escapeXml(this.buildAbsoluteUrl('/voice-calls/twilio/voice'))}</Redirect>`,
      '</Response>',
    ]
      .filter(Boolean)
      .join('');
  }

  private buildCompletionTwiml(): string {
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      `<Say>${this.escapeXml('Thank you. Your symptom responses have been recorded. Goodbye.')}</Say>`,
      '<Hangup/>',
      '</Response>',
    ].join('');
  }

  private buildRetryTwiml(message: string, question: SymptomQuestionLike): string {
    const prompt = `${message} ${this.buildQuestionPrompt(question)}`.trim();
    const gatherAttributes = this.buildGatherAttributes(question);
    const gatherAction = this.buildAbsoluteUrl('/voice-calls/twilio/gather');

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      `<Gather input="dtmf" action="${this.escapeXml(gatherAction)}" method="POST"${gatherAttributes}>`,
      `<Say>${this.escapeXml(prompt)}</Say>`,
      '</Gather>',
      `<Say>${this.escapeXml('We could not capture a valid answer. Goodbye.')}</Say>`,
      '<Hangup/>',
      '</Response>',
    ].join('');
  }

  private buildGatherAttributes(question: SymptomQuestionLike): string {
    const type = question.type;

    if (type === 'boolean') {
      return ' numDigits="1"';
    }

    if (type === 'single_choice') {
      const digits = String(Math.max(1, String((question.options ?? []).length).length));
      return ` numDigits="${digits}"`;
    }

    return ' finishOnKey="#" timeout="8"';
  }

  private buildQuestionPrompt(question: SymptomQuestionLike): string {
    const label = question.label?.trim() || 'Please answer the next question.';

    switch (question.type) {
      case 'boolean':
        return `${label} Press 1 for yes. Press 2 for no.`;
      case 'single_choice':
        return `${label} ${this.buildChoicePrompt(question.options ?? [])}`;
      case 'multiple_choice':
        return `${label} Enter the numbers of all matching options followed by the pound key. ${this.buildChoicePrompt(question.options ?? [])}`;
      case 'scale': {
        const min = question.validation?.min ?? 1;
        const max = question.validation?.max ?? 10;
        return `${label} Enter a number between ${min} and ${max}, then press the pound key.`;
      }
      case 'number':
        return `${label} Enter your answer using the keypad, then press the pound key.`;
      case 'date':
        return `${label} Enter the date using digits, then press the pound key.`;
      case 'text':
      default:
        return `${label} Enter your answer using the keypad, then press the pound key.`;
    }
  }

  private buildChoicePrompt(options: string[]): string {
    return options
      .map((option, index) => `Press ${index + 1} for ${option}.`)
      .join(' ');
  }

  private mapDigitsToAnswer(
    question: SymptomQuestionLike,
    digits: string,
  ): string | number | boolean | string[] {
    const cleanedDigits = digits.trim();

    switch (question.type) {
      case 'boolean':
        if (cleanedDigits === '1') return true;
        if (cleanedDigits === '2') return false;
        return INVALID_MARKER;
      case 'single_choice': {
        const optionIndex = Number.parseInt(cleanedDigits, 10) - 1;
        const option = (question.options ?? [])[optionIndex];
        return option ?? INVALID_MARKER;
      }
      case 'multiple_choice': {
        const selections = [...cleanedDigits]
          .map((digit) => Number.parseInt(digit, 10) - 1)
          .map((index) => (question.options ?? [])[index])
          .filter((option): option is string => !!option);

        return selections.length > 0 ? selections : INVALID_MARKER;
      }
      case 'scale': {
        const value = Number.parseInt(cleanedDigits, 10);
        if (!Number.isFinite(value)) return INVALID_MARKER;
        const min = question.validation?.min ?? 1;
        const max = question.validation?.max ?? 10;
        return value >= min && value <= max ? value : INVALID_MARKER;
      }
      case 'number': {
        const value = Number.parseInt(cleanedDigits, 10);
        return Number.isFinite(value) ? value : INVALID_MARKER;
      }
      case 'date':
      case 'text':
      default:
        return cleanedDigits || INVALID_MARKER;
    }
  }

  private stringifyMappedValue(value: string | number | boolean | string[]): string {
    return Array.isArray(value) ? JSON.stringify(value) : String(value);
  }

  private parseMappedValue(value: string, question: SymptomQuestionLike): string | number | boolean | string[] {
    if (question.type === 'boolean') {
      return value === 'true';
    }

    if (question.type === 'number' || question.type === 'scale') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : value;
    }

    if (question.type === 'multiple_choice') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [value];
      } catch {
        return [value];
      }
    }

    return value;
  }

  private async handleInvalidInput(
    session: VoiceCallSessionDocument,
    question: SymptomQuestionLike,
    rawDigits: string,
  ): Promise<string> {
    const questionId = this.getQuestionId(question);
    const invalidAttempts = session.answers.filter(
      (answer) => answer.questionId === questionId && answer.mappedValue === INVALID_MARKER,
    ).length;

    session.answers.push({
      questionId,
      rawDigits,
      mappedValue: INVALID_MARKER,
      answeredAt: new Date(),
    });
    session.lastWebhookAt = new Date();

    if (invalidAttempts >= 1) {
      session.status = 'failed';
      await session.save();
      return this.buildRetryTwiml('Invalid input received again.', question);
    }

    await session.save();
    return this.buildRetryTwiml('Invalid input. Please try once more.', question);
  }

  private findLatestValidAnswer(session: VoiceCallSessionDocument, questionId: string) {
    return [...session.answers]
      .reverse()
      .find((answer) => answer.questionId === questionId && answer.mappedValue !== INVALID_MARKER);
  }

  private handleDuplicateGather(
    session: VoiceCallSessionDocument,
    form: SymptomFormLike,
    digits: string,
  ): string | null {
    const lastValidAnswer = [...session.answers]
      .reverse()
      .find((answer) => answer.mappedValue !== INVALID_MARKER);

    if (!lastValidAnswer || lastValidAnswer.rawDigits !== digits) {
      return null;
    }

    const currentQuestion = this.getCurrentQuestion(session, form);
    if (!currentQuestion) {
      return this.buildCompletionTwiml();
    }

    if (lastValidAnswer.questionId === this.getQuestionId(currentQuestion)) {
      return null;
    }

    return this.buildQuestionTwiml(currentQuestion, false);
  }

  private async completeAndPersistSession(
    session: VoiceCallSessionDocument,
    form: SymptomFormLike,
  ): Promise<void> {
    if (session.status === 'completed' && session.completedAt) {
      return;
    }

    const questions = Array.isArray(form.questions) ? form.questions : [];
    const validAnswers = questions
      .map((question) => {
        const questionId = this.getQuestionId(question);
        const savedAnswer = this.findLatestValidAnswer(session, questionId);

        if (!savedAnswer) {
          return null;
        }

        return {
          questionId,
          value: this.parseMappedValue(savedAnswer.mappedValue ?? '', question),
        };
      })
      .filter((answer): answer is { questionId: string; value: string | number | boolean | string[] } => !!answer);

    if (validAnswers.length > 0) {
      await this.symptomsService.saveResponse({
        formId: session.formId,
        patientId: session.patientId,
        answers: validAnswers,
        channel: 'voice-call',
        source: 'twilio',
        metadata: {
          callSid: session.callSid,
        },
      } as any);
    }

    session.status = 'completed';
    session.completedAt = new Date();
    session.lastWebhookAt = new Date();
    await session.save();
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private mapVoiceTemperature(value: string | number): number | null {
    const digit = `${value}`.trim();

    if (digit === '1') {
      return 35.5;
    }

    if (digit === '2') {
      return 36.5;
    }

    return null;
  }

  private extractString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }
}
