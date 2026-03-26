import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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

type SymptomQuestionType =
  | 'text'
  | 'number'
  | 'scale'
  | 'single_choice'
  | 'multiple_choice'
  | 'date'
  | 'boolean'
  | 'rating'
  | 'yes_no';

type SymptomQuestionLike = {
  _id?: { toString(): string } | string;
  id?: { toString(): string } | string;
  label?: string;
  text?: string;
  type: SymptomQuestionType;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
  };
};

type SymptomFormLike = {
  _id?: { toString(): string } | string;
  id?: { toString(): string } | string;
  title?: string;
  questions?: SymptomQuestionLike[];
};

type InterpretedAnswer = string | number | boolean | string[] | null;

const INVALID_MARKER = '__invalid__';

@Injectable()
export class VoiceCallsService {
  private readonly logger = new Logger(VoiceCallsService.name);

  constructor(
    @InjectModel(VoiceCallSession.name)
    private readonly voiceCallSessionModel: Model<VoiceCallSessionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly symptomsService: SymptomsService,
    private readonly configService: ConfigService,
  ) {}

  async startCall(dto: StartVoiceCallDto) {
    const patient = await this.resolvePatient(dto);
    const phoneNumber = dto.phoneNumber?.trim() || patient.phoneNumber?.trim();

    if (!phoneNumber) {
      throw new BadRequestException('Patient phone number is required');
    }

    return this.placeOutboundCall(patient, phoneNumber);
  }

  async makeCall(phoneNumber: string) {
    const normalizedPhoneNumber = phoneNumber?.trim();

    if (!normalizedPhoneNumber) {
      throw new BadRequestException('phoneNumber is required');
    }

    const patient = await this.userModel.findOne({ phoneNumber: normalizedPhoneNumber }).exec();

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return this.placeOutboundCall(patient, normalizedPhoneNumber);
  }

  async handleIncomingVoice(dto: TwilioVoiceWebhookDto & Record<string, unknown>): Promise<string> {
    const callSid = this.extractString(dto.CallSid);
    const phoneNumber = this.extractString(dto.From);

    if (!callSid) {
      throw new BadRequestException('CallSid is required');
    }

    const session = await this.getOrCreateSession(callSid, phoneNumber);
    const form = await this.loadAssignedFormForSession(session);

    session.lastWebhookAt = new Date();
    if (session.status === 'initiated') {
      session.status = 'in_progress';
    }
    await session.save();

    const question = this.getCurrentQuestion(session, form);
    if (!question) {
      await this.completeAndPersistSession(session, form);
      return this.buildCompletionTwiml();
    }

    return this.renderQuestionTwiml(question, true);
  }

  async handleVoiceResponse(dto: TwilioVoiceWebhookDto & Record<string, unknown>): Promise<string> {
    const callSid = this.extractString(dto.CallSid);
    const digits = this.extractString(dto.Digits);

    if (!callSid) {
      throw new BadRequestException('CallSid is required');
    }

    const session = await this.findByCallSid(callSid);
    const form = await this.loadAssignedFormForSession(session);
    const question = this.getCurrentQuestion(session, form);

    if (!question) {
      await this.completeAndPersistSession(session, form);
      return this.buildCompletionTwiml();
    }

    session.lastWebhookAt = new Date();

    if (!digits) {
      await session.save();
      return this.buildRepeatQuestionTwiml(question, 'Nous n avons pas recu de reponse.');
    }

    const interpretedValue = this.interpretDigits(question, digits);
    if (interpretedValue === INVALID_MARKER) {
      await session.save();
      return this.buildRepeatQuestionTwiml(question, 'Reponse invalide. Veuillez recommencer.');
    }

    session.answers.push({
      questionId: this.getQuestionId(question),
      rawDigits: digits,
      value: digits,
      mappedValue: this.stringifyMappedValue(interpretedValue),
      interpretedValue,
      answeredAt: new Date(),
    });
    session.currentQuestionIndex += 1;
    session.status = 'in_progress';
    await session.save();

    const nextQuestion = this.getCurrentQuestion(session, form);
    if (!nextQuestion) {
      await this.completeAndPersistSession(session, form);
      return this.buildCompletionTwiml();
    }

    return this.renderQuestionTwiml(nextQuestion, false);
  }

  async handleStatus(dto: TwilioVoiceWebhookDto & Record<string, unknown>) {
    const callSid = this.extractString(dto.CallSid);
    if (!callSid) {
      throw new BadRequestException('CallSid is required');
    }

    const session = await this.findByCallSid(callSid);
    session.lastWebhookAt = new Date();

    const rawStatus = this.extractString((dto as Record<string, unknown>).CallStatus);
    const normalizedStatus = rawStatus.toLowerCase();

    if (normalizedStatus === 'completed') {
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

  @Cron('0 8 * * *', { timeZone: 'Africa/Lagos' })
  async triggerMorningReminderCalls() {
    const patients = await this.userModel
      .find({
        phoneNumber: { $exists: true, $ne: '' },
      })
      .exec();

    for (const patient of patients) {
      try {
        const form = await this.loadAssignedForm(patient._id.toString());
        if (!form || !Array.isArray(form.questions) || form.questions.length === 0) {
          continue;
        }

        const todayResponse = await this.symptomsService.getTodayResponse(patient._id.toString());
        if (todayResponse) {
          continue;
        }

        const phoneNumber = patient.phoneNumber?.trim();
        if (!phoneNumber) {
          continue;
        }

        await this.placeOutboundCall(patient, phoneNumber);
      } catch (error) {
        this.logger.error(
          `Failed to trigger reminder call for patient ${patient._id.toString()}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  async createSession(data: CreateVoiceCallSessionInput): Promise<VoiceCallSession> {
    return this.voiceCallSessionModel.create({
      ...data,
      currentQuestionIndex: data.currentQuestionIndex ?? 0,
      status: data.status ?? 'initiated',
      channel: data.channel ?? 'voice-call',
      provider: data.provider ?? 'twilio',
      startedAt: data.startedAt ?? new Date(),
      answers: [],
    });
  }

  async findByCallSid(callSid: string): Promise<VoiceCallSessionDocument> {
    const session = await this.voiceCallSessionModel.findOne({ callSid }).exec();

    if (!session) {
      throw new NotFoundException(`Voice call session ${callSid} not found`);
    }

    return session;
  }

  generateTwiML(question: SymptomQuestionLike, actionUrl: string, retryMessage?: string): string {
    const prompt = this.buildQuestionPrompt(question);
    const gatherAttributes = this.buildGatherAttributes(question);
    const voiceUrl = this.buildAbsoluteUrl('/voice-calls/twilio/voice');
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      retryMessage ? `<Say>${this.escapeXml(retryMessage)}</Say>` : '',
      `<Gather input="dtmf" action="${this.escapeXml(actionUrl)}" method="POST"${gatherAttributes}>`,
      `<Say>${this.escapeXml(prompt)}</Say>`,
      '</Gather>',
      `<Say>${this.escapeXml("Nous n'avons pas recu de reponse.")}</Say>`,
      `<Redirect method="POST">${this.escapeXml(voiceUrl)}</Redirect>`,
      '</Response>',
    ];

    return lines.filter(Boolean).join('');
  }

  private async placeOutboundCall(patient: UserDocument, phoneNumber: string) {
    const form = await this.loadAssignedForm(patient._id.toString());
    const formId = this.getFormId(form);
    const voiceUrl = this.buildAbsoluteUrl('/voice-calls/twilio/voice');
    const statusUrl = this.buildAbsoluteUrl('/voice-calls/twilio/status');
    const twilioCall = await this.createTwilioCall(phoneNumber, voiceUrl, statusUrl);

    const existingSession = await this.voiceCallSessionModel.findOne({ callSid: twilioCall.sid }).exec();
    if (!existingSession) {
      await this.createSession({
        callSid: twilioCall.sid,
        patientId: patient._id.toString(),
        formId,
        phoneNumber,
        currentQuestionIndex: 0,
        status: 'initiated',
        startedAt: new Date(),
        lastWebhookAt: null,
      });
    }

    return {
      message: 'Voice call started',
      callSid: twilioCall.sid,
      patientId: patient._id.toString(),
      formId,
      status: 'initiated',
    };
  }

  private async getOrCreateSession(callSid: string, phoneNumber: string): Promise<VoiceCallSessionDocument> {
    const existingSession = await this.voiceCallSessionModel.findOne({ callSid }).exec();
    if (existingSession) {
      return existingSession;
    }

    const normalizedPhoneNumber = phoneNumber?.trim();
    if (!normalizedPhoneNumber) {
      throw new BadRequestException('From phone number is required');
    }

    const patient = await this.userModel.findOne({ phoneNumber: normalizedPhoneNumber }).exec();
    if (!patient) {
      throw new NotFoundException('Patient not found for incoming call');
    }

    const form = await this.loadAssignedForm(patient._id.toString());
    const formId = this.getFormId(form);

    return this.voiceCallSessionModel.create({
      callSid,
      patientId: patient._id.toString(),
      formId,
      phoneNumber: normalizedPhoneNumber,
      currentQuestionIndex: 0,
      answers: [],
      status: 'in_progress',
      startedAt: new Date(),
      lastWebhookAt: new Date(),
      channel: 'voice-call',
      provider: 'twilio',
    });
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

  private async loadAssignedFormForSession(session: VoiceCallSessionDocument): Promise<SymptomFormLike> {
    if (!session.patientId) {
      throw new InternalServerErrorException('Voice call session patientId is missing');
    }

    return this.loadAssignedForm(session.patientId);
  }

  private getFormId(form: SymptomFormLike): string {
    const formId = form?._id?.toString?.() ?? form?.id?.toString?.() ?? `${form?._id ?? form?.id ?? ''}`;
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
    const questionId =
      question?._id?.toString?.() ?? question?.id?.toString?.() ?? `${question?._id ?? question?.id ?? ''}`;

    if (!questionId) {
      throw new InternalServerErrorException('Question id is missing');
    }

    return questionId;
  }

  private getQuestionLabel(question: SymptomQuestionLike): string {
    return question.label?.trim() || question.text?.trim() || 'Question suivante.';
  }

  private normalizeQuestionType(type: SymptomQuestionType): SymptomQuestionType {
    if (type === 'rating') {
      return 'scale';
    }

    if (type === 'yes_no') {
      return 'boolean';
    }

    return type;
  }

  private renderQuestionTwiml(question: SymptomQuestionLike, includeGreeting: boolean): string {
    const actionUrl = this.buildAbsoluteUrl('/voice-calls/twilio/handle-response');
    let intro = '';

    if (includeGreeting) {
      intro = 'Bonjour. MediFollow vous appelle pour votre suivi de symptomes.';
    }

    return this.generateTwiML(question, actionUrl, intro);
  }

  private buildCompletionTwiml(): string {
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      `<Say>${this.escapeXml('Merci, vos reponses ont ete enregistrees.')}</Say>`,
      '<Hangup/>',
      '</Response>',
    ].join('');
  }

  private buildRepeatQuestionTwiml(question: SymptomQuestionLike, message: string): string {
    const actionUrl = this.buildAbsoluteUrl('/voice-calls/twilio/handle-response');
    return this.generateTwiML(question, actionUrl, message);
  }

  private buildQuestionPrompt(question: SymptomQuestionLike): string {
    const label = this.getQuestionLabel(question);
    const type = this.normalizeQuestionType(question.type);
    const options = Array.isArray(question.options) ? question.options : [];

    switch (type) {
      case 'scale':
        return `${label}. Donnez une note entre 1 et 9.`;
      case 'boolean':
        return `${label}. Appuyez sur 1 pour oui, 2 pour non.`;
      case 'number':
        return `${label}. Entrez votre valeur puis diese.`;
      case 'single_choice':
        return `${label}. ${this.buildChoicePrompt(options)}`;
      case 'multiple_choice':
        return `${label}. ${this.buildChoicePrompt(options)} Entrez vos choix puis diese.`;
      case 'date':
        return `${label}. Entrez la date en chiffres puis diese.`;
      case 'text':
      default:
        return `${label}. Entrez votre reponse puis diese.`;
    }
  }

  private buildChoicePrompt(options: string[]): string {
    return options
      .map((option, index) => `Appuyez sur ${index + 1} pour ${option}.`)
      .join(' ');
  }

  private buildGatherAttributes(question: SymptomQuestionLike): string {
    const type = this.normalizeQuestionType(question.type);

    if (type === 'scale' || type === 'boolean' || type === 'single_choice') {
      return ' numDigits="1"';
    }

    return ' finishOnKey="#" timeout="8"';
  }

  private interpretDigits(question: SymptomQuestionLike, digits: string): InterpretedAnswer | typeof INVALID_MARKER {
    const cleanedDigits = digits.trim();
    const type = this.normalizeQuestionType(question.type);
    const options = Array.isArray(question.options) ? question.options : [];

    switch (type) {
      case 'scale': {
        const value = Number.parseInt(cleanedDigits, 10);
        return value >= 1 && value <= 9 ? value : INVALID_MARKER;
      }
      case 'boolean':
        if (cleanedDigits === '1') {
          return true;
        }
        if (cleanedDigits === '2') {
          return false;
        }
        return INVALID_MARKER;
      case 'number': {
        const value = Number.parseFloat(cleanedDigits);
        return Number.isFinite(value) ? value : INVALID_MARKER;
      }
      case 'single_choice': {
        const optionIndex = Number.parseInt(cleanedDigits, 10) - 1;
        return options[optionIndex] ?? INVALID_MARKER;
      }
      case 'multiple_choice': {
        const values = [...cleanedDigits]
          .map((digit) => Number.parseInt(digit, 10) - 1)
          .map((index) => options[index])
          .filter((option): option is string => Boolean(option));

        return values.length > 0 ? values : INVALID_MARKER;
      }
      case 'date':
      case 'text':
      default:
        return cleanedDigits || INVALID_MARKER;
    }
  }

  private stringifyMappedValue(value: InterpretedAnswer | typeof INVALID_MARKER): string | null {
    if (value === null || value === INVALID_MARKER) {
      return null;
    }

    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }

    return String(value);
  }

  private async createTwilioCall(to: string, voiceUrl: string, statusUrl: string) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const from = this.configService.get<string>('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !from) {
      throw new InternalServerErrorException('Twilio credentials are not configured');
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

  private async completeAndPersistSession(
    session: VoiceCallSessionDocument,
    form: SymptomFormLike,
  ): Promise<void> {
    if (session.status === 'completed' && session.completedAt) {
      return;
    }

    const answers = session.answers
      .filter((answer) => answer.questionId && answer.interpretedValue !== undefined)
      .map((answer) => ({
        questionId: answer.questionId,
        value: answer.interpretedValue ?? null,
      }));

    if (answers.length > 0 && session.formId && session.patientId) {
      await this.symptomsService.saveResponse({
        formId: session.formId,
        patientId: session.patientId,
        date: new Date(),
        answers,
        channel: 'voice-call',
        source: 'twilio',
        metadata: {
          callSid: session.callSid,
          symptomTitle: form.title ?? null,
        },
      } as any);
    }

    session.status = 'completed';
    session.completedAt = new Date();
    session.lastWebhookAt = new Date();
    await session.save();
  }

  private extractString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
