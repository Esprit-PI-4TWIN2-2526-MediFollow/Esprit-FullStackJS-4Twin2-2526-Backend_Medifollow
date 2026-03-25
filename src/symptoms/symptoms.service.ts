import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import Groq from 'groq-sdk';
import { CreateSymptomDto } from './dto/create-symptom.dto';
import { Symptom, SymptomDocument } from './schemas/symptom.schema';
import { SymptomResponse, SymptomResponseDocument } from './schemas/symptom-response.schema';
import { SubmitResponseDto } from './dto/submit-response.dto';
import { GenerateSymptomDto } from './dto/generate-symptom.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateSymptomDto } from './dto/update-symptom.dto';
import { Question, QuestionType } from './schemas/question.schema';
import { ResponseActionDto } from './dto/response-action.dto';
import { User, UserDocument } from 'src/users/users.schema';

// ── Mapping: medical service → clinical focus areas ──────────────────────────
//
// Each entry lists the concrete vitals, observations and actions that are
// clinically relevant for that department.  The AI prompt injects these hints
// so that it generates questions specific to the service rather than generic
// symptom follow-up questions.
//
const SERVICE_CLINICAL_HINTS: Record<string, string> = {
  Cardiology: `
  Focus on: heart rate (bpm), blood pressure (mmHg), oxygen saturation (SpO2 %),
  chest pain (location, radiation, intensity 1-10), palpitations, shortness of breath
  at rest vs effort, ankle/leg oedema, syncope episodes, nitrate intake, weight change
  (cardiac fluid retention indicator).`,

  Neurology: `
  Focus on: headache (location, intensity 1-10, pulsating vs pressure), dizziness /
  vertigo, visual disturbances, speech difficulties, limb weakness or numbness,
  coordination problems, seizure frequency, memory lapses, sleep quality, medication
  adherence (anticonvulsants, etc.).`,

  Pediatrics: `
  Focus on: body temperature (°C), feeding / appetite (breast, bottle, solids),
  hydration status (number of wet nappies / urination), stool consistency and colour,
  vomiting episodes, rash presence and location, crying pattern, sleep hours,
  vaccination reactions, caregiver concern level.`,

  Oncology: `
  Focus on: pain level (1-10, location), fatigue severity, nausea/vomiting frequency,
  appetite and weight loss, mucositis / mouth sores, hair loss distress, chemotherapy
  side-effects (numbness, tingling), dressing / port-site condition (clean, red,
  oozing), emotional wellbeing.`,

  'General Medicine': `
  Focus on: body temperature (°C), heart rate, blood pressure, general pain level
  (1-10), fatigue, cough (dry/productive), appetite, bowel movements, urination
  frequency, recent medication changes, wound or dressing condition if applicable.`,

  Orthopedics: `
  Focus on: wound / surgical site condition (clean, redness, swelling, discharge),
  dressing change performed (yes/no) and date, pain level at rest and during movement
  (1-10), joint range of motion, weight-bearing ability, physiotherapy exercises
  compliance, cast or brace integrity, limb swelling or colour change.`,

  Dermatology: `
  Focus on: lesion / rash extent and location, colour changes, itching intensity
  (1-10), oozing or crusting, dressing change (done/not done), topical treatment
  applied (yes/no), sun exposure, new lesions appeared, allergic reaction signs,
  skin dryness or peeling.`,

  Psychiatry: `
  Focus on: mood rating (1-10), sleep quality and hours, appetite, suicidal ideation
  (safe screening), anxiety level (1-10), medication taken as prescribed (yes/no),
  social interaction, concentration ability, substance use, recent stressful events,
  hallucination or delusion episodes.`,

  Radiology: `
  Focus on: contrast reaction symptoms (nausea, rash, dyspnea) after imaging,
  injection site condition (pain, bruising, swelling), pain level post-procedure
  (1-10), hydration intake post-contrast, ability to void normally, any new
  neurological symptoms post-myelogram if applicable.`,

  Surgery: `
  Focus on: surgical wound condition (clean, red, swollen, discharge colour/amount),
  dressing change performed (yes/no) and last date, pain level at rest and on
  movement (1-10), body temperature (fever watch), nausea/vomiting post-op,
  bowel sounds / first flatus or bowel movement, drain output if present (volume,
  colour), mobilisation level, ability to eat and drink.`,
};

// ── Default hints used when no specific service match is found ────────────────
const DEFAULT_CLINICAL_HINTS = `
  Focus on: body temperature (°C), heart rate, pain level (1-10), fatigue,
  wound / dressing condition, appetite, hydration, medication adherence.`;

type FrontendQuestionType =
  | 'text'
  | 'number'
  | 'rating'
  | 'yes/no'
  | 'single choice'
  | 'multiple choice'
  | 'select'
  | 'date';

type FrontendGeneratedQuestion = {
  label: string;
  type: FrontendQuestionType;
  options: string[];
};

const FRONTEND_QUESTION_TYPES: FrontendQuestionType[] = [
  'text',
  'number',
  'rating',
  'yes/no',
  'single choice',
  'multiple choice',
  'select',
  'date',
];

type SymptomResponseByDateItem = {
  formId: Symptom | Types.ObjectId | string;
  answers: Array<{
    question: string;
    answer: string | number | boolean | string[] | null;
  }>;
  createdAt: Date;
};

type SymptomVitalsView = {
  bloodPressure: string | null;
  heartRate: number | null;
  temperature: number | null;
  weight: number | null;
};

type NurseVisibleResponseItem = {
  _id: string;
  patientId: string;
  patientName: string;
  patientDepartment: string;
  submittedAt: Date;
  vitals: SymptomVitalsView;
  validated: boolean;
  validatedBy: string | null;
  validatedByName: string | null;
  validatedAt: Date | null;
  validationNote: string;
  issueReported: boolean;
  formId?: string;
  answers?: Array<{
    question: string;
    answer: string | number | boolean | string[] | null;
  }>;
};

@Injectable()
export class SymptomsService {
  private client = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  constructor(
    @InjectModel(Symptom.name)
    private symptomModel: Model<SymptomDocument>,
    @InjectModel(SymptomResponse.name)
    private symptomResponseModel: Model<SymptomResponseDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async create(dto: CreateSymptomDto): Promise<Symptom> {
    console.log(dto);

    const questions = this.normalizeQuestions(dto.questions ?? []);

    if (dto.isActive !== false) {
      const deactivateFilter: Record<string, unknown> = { isActive: true };
      deactivateFilter.patientId = dto.patientId;

      await this.symptomModel.updateMany(deactivateFilter, { $set: { isActive: false } }).exec();
    }

    return this.symptomModel.create({
      title: dto.title.trim(),
      patientId: dto.patientId,
      questions,
      isActive: dto.isActive ?? true,
    });
  }

  async findAll(): Promise<Symptom[]> {
    return this.symptomModel.find().sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<Symptom> {
    if (!id || !isValidObjectId(id)) {
      throw new BadRequestException('Invalid symptom form id');
    }

    const symptom = await this.symptomModel.findById(id).exec();
    if (!symptom) {
      throw new NotFoundException(`Symptom form ${id} not found`);
    }

    return symptom;
  }

  async getLatestActive(): Promise<Symptom> {
    const symptom = await this.symptomModel
      .findOne({ isActive: true })
      .sort({ createdAt: -1 })
      .exec();

    if (!symptom) {
      throw new NotFoundException('No active symptom form found');
    }

    return symptom;
  }

  async findFormByPatient(patientId: string): Promise<Symptom> {
    const normalizedPatientId = patientId?.trim();

    if (!normalizedPatientId) {
      throw new BadRequestException('Invalid patientId');
    }

    const symptom = await this.symptomModel
      .findOne({
        patientId: normalizedPatientId,
        isActive: true,
      })
      .sort({ createdAt: -1, _id: -1 })
      .exec();

    if (!symptom) {
      throw new NotFoundException(`No active symptom form found for patient ${normalizedPatientId}`);
    }

    return symptom;
  }

  async update(id: string, dto: UpdateSymptomDto): Promise<Symptom> {
    if (!id || !isValidObjectId(id)) {
      throw new BadRequestException('Invalid symptom form id');
    }

    const existing = await this.symptomModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException(`Symptom form ${id} not found`);
    }

    const updateData: Partial<Symptom> = {};

    if (typeof dto.title === 'string') {
      const title = dto.title.trim();
      if (!title) throw new BadRequestException('title must not be empty');
      updateData.title = title;
    }

    if (dto.questions !== undefined) {
      updateData.questions = this.normalizeQuestions(dto.questions);
    }

    if (typeof dto.isActive === 'boolean') {
      updateData.isActive = dto.isActive;
      if (dto.isActive) {
        await this.symptomModel
          .updateMany({ _id: { $ne: id }, isActive: true }, { $set: { isActive: false } })
          .exec();
      }
    }

    const updated = await this.symptomModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();

    if (!updated) throw new NotFoundException(`Symptom form ${id} not found`);

    return updated;
  }

  async remove(id: string): Promise<void> {
    if (!id || !isValidObjectId(id)) {
      throw new BadRequestException('Invalid symptom form id');
    }

    const deleted = await this.symptomModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException(`Symptom form ${id} not found`);
  }

  async saveResponse(dto: SubmitResponseDto): Promise<SymptomResponse> {
    if (!dto.formId || !isValidObjectId(dto.formId)) {
      throw new BadRequestException('Invalid formId');
    }

    const normalizedPatientId = typeof dto.patientId === 'string' ? dto.patientId.trim() : '';

    if (dto.patientId && !normalizedPatientId) {
      throw new BadRequestException('Invalid patientId');
    }

    const symptomForm = await this.symptomModel
      .findById(dto.formId)
      .exec();

    if (!symptomForm) {
      throw new NotFoundException(`Symptom form ${dto.formId} not found`);
    }

    if (!Array.isArray(dto.answers) || dto.answers.length === 0) {
      throw new BadRequestException('answers must be a non-empty array');
    }

    const responseDate = this.normalizeDate(dto.date ? new Date(dto.date) : new Date());

    if (normalizedPatientId) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const count = await this.symptomResponseModel
        .countDocuments({
          patientId: normalizedPatientId,
          createdAt: {
            $gte: todayStart,
            $lte: todayEnd,
          },
        })
        .exec();

      if (count >= 3) {
        throw new BadRequestException('Maximum 3 submissions per day reached');
      }
    }

    const formQuestionIds = new Set(
      symptomForm.questions
        .map((question) => {
          const questionId = (question as Question & { _id?: Types.ObjectId })._id;
          return questionId?.toString();
        })
        .filter(Boolean),
    );

    const normalizedAnswers = dto.answers.map((answer, index) => {
      if (!answer?.questionId || !isValidObjectId(answer.questionId)) {
        throw new BadRequestException(`Answer ${index + 1}: invalid questionId`);
      }

      if (!formQuestionIds.has(answer.questionId)) {
        throw new BadRequestException(
          `Answer ${index + 1}: questionId does not belong to form ${dto.formId}`,
        );
      }

      return {
        questionId: answer.questionId,
        value: answer.value ?? null,
      };
    });

    const response = new this.symptomResponseModel({
      symptomFormId: new Types.ObjectId(symptomForm.id),
      ...(normalizedPatientId ? { patientId: normalizedPatientId } : {}),
      answers: normalizedAnswers,
      date: responseDate,
      vitals: this.extractVitals(symptomForm, normalizedAnswers),
      validated: false,
      validatedBy: null,
      validatedByName: null,
      validatedAt: null,
      validationNote: '',
      issueReported: false,
    });

    return response.save();
  }

  async submitResponse(dto: SubmitResponseDto): Promise<SymptomResponse> {
    return this.saveResponse(dto);
  }

  async getTodayResponse(patientId: string): Promise<SymptomResponse | null> {
    const normalizedPatientId = patientId?.trim();

    if (!normalizedPatientId) {
      throw new BadRequestException('Invalid patientId');
    }

    const today = new Date();

    return this.symptomResponseModel
      .findOne({
        patientId: normalizedPatientId,
        date: {
          $gte: this.getStartOfDay(today),
          $lt: this.getEndOfDay(today),
        },
      })
      .populate('symptomFormId', 'title isActive patientId')
      .sort({ createdAt: -1, _id: -1 })
      .exec();
  }

  async getPatientResponses(patientId: string): Promise<SymptomResponse[]> {
    const normalizedPatientId = patientId?.trim();

    if (!normalizedPatientId) {
      throw new BadRequestException('Invalid patientId');
    }

    return this.symptomResponseModel
      .find({ patientId: normalizedPatientId })
      .populate('symptomFormId', 'title isActive')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getByDate(patientId: string, date: string): Promise<SymptomResponseByDateItem[]> {
    const normalizedPatientId = patientId?.trim();

    if (!normalizedPatientId) {
      throw new BadRequestException('Invalid patientId');
    }

    const start = new Date(date);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('Invalid date');
    }

    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    const responses = await this.symptomResponseModel
      .find({
        patientId: normalizedPatientId,
        createdAt: {
          $gte: start,
          $lte: end,
        },
      })
      .populate('symptomFormId')
      .sort({ createdAt: -1, _id: -1 })
      .exec();

    return responses.map((response) => {
      const form =
        response.symptomFormId &&
        typeof response.symptomFormId === 'object' &&
        'questions' in response.symptomFormId
          ? (response.symptomFormId as unknown as Symptom)
          : null;

      const questionMap = new Map(
        (form?.questions ?? []).map((question) => [question._id?.toString(), question.label]),
      );

      return {
        formId: response.symptomFormId,
        answers: response.answers.map((answer) => ({
          question: questionMap.get(answer.questionId) ?? answer.questionId,
          answer: answer.value,
        })),
        createdAt: response.createdAt ?? response.date,
      };
    });
  }

  async getNurseResponses(authUser: { sub?: string; userId?: string }): Promise<NurseVisibleResponseItem[]> {
    return this.listNurseResponses(authUser);
  }

  async getPendingNurseResponses(
    authUser: { sub?: string; userId?: string },
  ): Promise<NurseVisibleResponseItem[]> {
    return this.listNurseResponses(authUser, false);
  }

  async getValidatedNurseResponses(
    authUser: { sub?: string; userId?: string },
  ): Promise<NurseVisibleResponseItem[]> {
    return this.listNurseResponses(authUser, true);
  }

  async getNurseResponseById(
    authUser: { sub?: string; userId?: string },
    responseId: string,
  ): Promise<NurseVisibleResponseItem> {
    const nurse = await this.getNurseUser(authUser);
    const response = await this.findVisibleResponseForNurse(responseId, nurse.assignedDepartment);
    const patient = await this.getPatientForVisibleResponse(response, nurse.assignedDepartment);

    return this.formatNurseResponse(response, patient, true);
  }

  async validateResponse(
    authUser: { sub?: string; userId?: string },
    responseId: string,
    dto: ResponseActionDto,
  ): Promise<NurseVisibleResponseItem> {
    const nurse = await this.getNurseUser(authUser);
    const response = await this.findVisibleResponseForNurse(responseId, nurse.assignedDepartment);
    const patient = await this.getPatientForVisibleResponse(response, nurse.assignedDepartment);

    if (response.validated) {
      throw new ConflictException('Response already validated');
    }

    response.validated = true;
    response.validatedBy = nurse._id.toString();
    response.validatedByName = this.buildUserDisplayName(nurse);
    response.validatedAt = new Date();
    response.validationNote = dto.note?.trim() ?? '';

    await response.save();

    return this.formatNurseResponse(response, patient, true);
  }

  async reportIssue(
    authUser: { sub?: string; userId?: string },
    responseId: string,
    dto: ResponseActionDto,
  ): Promise<NurseVisibleResponseItem> {
    const nurse = await this.getNurseUser(authUser);
    const response = await this.findVisibleResponseForNurse(responseId, nurse.assignedDepartment);
    const patient = await this.getPatientForVisibleResponse(response, nurse.assignedDepartment);

    response.issueReported = true;

    const note = dto.note?.trim();
    if (note) {
      response.validationNote = response.validationNote
        ? `${response.validationNote}\nIssue reported: ${note}`
        : note;
    }

    await response.save();

    return this.formatNurseResponse(response, patient, true);
  }

  // ── AI Question Generation ────────────────────────────────────────────────────

  async generateQuestions(dto: GenerateSymptomDto): Promise<{ questions: FrontendGeneratedQuestion[] }> {
    const title             = dto.title?.trim();
    const description       = dto.description?.trim() ?? '';
    const medicalService    = dto.medicalService?.trim() ?? '';
    const numberOfQuestions = dto.numberOfQuestions ?? 7;

    if (!title) throw new BadRequestException('title is required');

    // Pick the clinical hints for the declared service (case-insensitive lookup)
    const serviceKey    = Object.keys(SERVICE_CLINICAL_HINTS).find(
      (k) => k.toLowerCase() === medicalService.toLowerCase(),
    );
    const clinicalHints = serviceKey
      ? SERVICE_CLINICAL_HINTS[serviceKey]
      : DEFAULT_CLINICAL_HINTS;

    // ── System prompt ─────────────────────────────────────────────────────────
    const systemPrompt = `
You are a senior clinical nurse specialist who designs post-visit and daily
follow-up symptom forms for a hospital digital-health platform.

Your forms are filled in by patients at home (or by bedside nurses) and are
reviewed by the medical team to detect early deterioration.

=== OUTPUT FORMAT ===
Return ONLY a valid JSON array. No markdown, no backticks, no commentary.
Each element must strictly follow this structure:
{
  "label":    "<question text in plain language>",
  "type":     "<one of: text | number | rating | yes/no | single choice | multiple choice | select | date>",
  "options":  ["<option 1>", "<option 2>", ...]   ← always present, empty [] when not applicable
}

=== TYPE SELECTION RULES ===
• "number"          → measurable numeric vitals: temperature (°C), heart rate (bpm),
                      oxygen saturation (%), blood pressure (e.g. 120/80), weight (kg),
                      drain output (mL), pain numeric score when you need a raw number.
• "rating"          → subjective intensity rated 1-10: pain, fatigue, nausea, anxiety,
                      breathlessness, mood — anything the patient self-rates.
• "yes/no"          → simple yes/no observations: dressing changed, fever present,
                      medication taken, wound oozing, vomiting occurred, able to walk.
• "single choice"   → one answer from a fixed list: wound appearance (clean / red /
                      swollen / discharge), stool consistency (Bristol scale), mobility
                      level, diet tolerance.
• "multiple choice" → one or more answers from a list: associated symptoms (nausea AND
                      dizziness AND headache), location of pain.
• "select"          → one answer chosen from a dropdown list when a compact list UI is suitable.
• "date"            → last dressing change date, last bowel movement date, date of
                      symptom onset.
• "text"            → open descriptions: nature of discharge, additional comments,
                      anything that cannot be captured by the above types.

=== CLINICAL DEPTH RULES ===
1. Always include at least ONE vital-sign question relevant to the service
   (temperature, SpO2, heart rate, blood pressure, weight…).
2. Always include at least ONE dressing / wound-care question when the service
   involves surgical or skin management (Surgery, Orthopedics, Dermatology, Oncology).
3. Always include at least ONE pain question using "rating" type.
4. For yes/no questions about actions (dressing changed? medication taken?),
   add a follow-up "date" or "text" question when timing or detail matters.
5. Questions must be concise, written in plain patient-friendly language (no jargon).
6. Do NOT generate generic questions like "How are you feeling today?" —
   every question must map to a specific clinical observable.

=== SERVICE-SPECIFIC CLINICAL FOCUS ===
${clinicalHints}
`.trim();

    // ── User prompt ───────────────────────────────────────────────────────────
    const userPrompt = `
Generate exactly ${numberOfQuestions} symptom follow-up questions.

Form title:       ${title}
Medical service:  ${medicalService || 'General Medicine'}
Description:      ${description || 'Daily patient symptom follow-up'}

Return raw JSON array only.
`.trim();

    // ── Groq call ─────────────────────────────────────────────────────────────
    try {
      const completion = await this.client.chat.completions.create({
        model:       'llama-3.3-70b-versatile',
        temperature: 0.3,   // lower = more deterministic, medically consistent
        max_tokens:  2000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? '';
      if (!raw) throw new InternalServerErrorException('Empty response from AI model');
      console.log('Raw AI symptom questions output:', raw);

      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new SyntaxError('No JSON array found in the response');

      const parsed = JSON.parse(jsonMatch[0]) as unknown[];
      const questions = this.normalizeGeneratedQuestions(parsed, numberOfQuestions);
      console.log('Normalized AI symptom questions output:', JSON.stringify({ questions }));

      return { questions };
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof InternalServerErrorException
      ) throw err;

      if (err instanceof SyntaxError) {
        throw new InternalServerErrorException('AI response is not valid JSON');
      }

      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new InternalServerErrorException(`AI generation error: ${message}`);
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private normalizeQuestions(questions: CreateQuestionDto[]): Question[] {
    if (!Array.isArray(questions)) {
      throw new BadRequestException('questions must be an array');
    }

    return questions.map((question, index) => {
      if (!question?.label?.trim()) {
        throw new BadRequestException(`Question ${index + 1}: label is required`);
      }
      if (!question?.type?.trim()) {
        throw new BadRequestException(`Question ${index + 1}: type is required`);
      }

      const options = Array.isArray(question.options)
        ? question.options
            .map((option) => option?.trim())
            .filter((option): option is string => !!option)
        : [];

      return {
        ...question,
        label:    question.label.trim(),
        type:     question.type.trim() as QuestionType,
        order:    question.order ?? index,
        required: question.required ?? false,
        options,
      };
    });
  }

  private normalizeGeneratedQuestions(
    questions: unknown[],
    expectedCount: number,
  ): FrontendGeneratedQuestion[] {
    if (!Array.isArray(questions)) {
      throw new BadRequestException('questions must be an array');
    }

    const normalizedQuestions = questions
      .map((question, index) => this.normalizeGeneratedQuestion(question, index))
      .filter((question): question is FrontendGeneratedQuestion => question !== null);

    while (normalizedQuestions.length < expectedCount) {
      normalizedQuestions.push({
        label: `Additional symptom question ${normalizedQuestions.length + 1}`,
        type: 'text',
        options: [],
      });
    }

    return normalizedQuestions.slice(0, expectedCount);
  }

  private normalizeGeneratedQuestion(
    question: unknown,
    index: number,
  ): FrontendGeneratedQuestion | null {
    if (!question || typeof question !== 'object') {
      return null;
    }

    const record = question as Record<string, unknown>;
    const label = this.extractQuestionLabel(record);
    const type = this.normalizeGeneratedQuestionType(record.type ?? record.inputType);

    if (!label || !type) {
      return null;
    }

    return {
      label,
      type,
      options: this.normalizeGeneratedQuestionOptions(record, type, index),
    };
  }

  private extractQuestionLabel(question: Record<string, unknown>): string {
    const labelCandidates = [
      question.label,
      question.question,
      question.questionText,
      question.prompt,
      question.text,
    ];

    for (const candidate of labelCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return '';
  }

  private normalizeGeneratedQuestionType(typeValue: unknown): FrontendQuestionType | null {
    if (typeof typeValue !== 'string') {
      return null;
    }

    const normalizedType = typeValue.trim().toLowerCase().replace(/[_-]+/g, ' ');

    const typeMap: Record<string, FrontendQuestionType> = {
      text: 'text',
      textarea: 'text',
      string: 'text',
      number: 'number',
      numeric: 'number',
      integer: 'number',
      float: 'number',
      rating: 'rating',
      scale: 'rating',
      likert: 'rating',
      'yes/no': 'yes/no',
      yesno: 'yes/no',
      boolean: 'yes/no',
      bool: 'yes/no',
      checkbox: 'multiple choice',
      checkboxes: 'multiple choice',
      radio: 'single choice',
      dropdown: 'select',
      select: 'select',
      'single choice': 'single choice',
      singlechoice: 'single choice',
      choice: 'single choice',
      'single select': 'single choice',
      'multiple choice': 'multiple choice',
      multiplechoice: 'multiple choice',
      multiselect: 'multiple choice',
      'multi select': 'multiple choice',
      date: 'date',
      datetime: 'date',
    };

    const mappedType = typeMap[normalizedType];
    if (mappedType && FRONTEND_QUESTION_TYPES.includes(mappedType)) {
      return mappedType;
    }

    return null;
  }

  private normalizeGeneratedQuestionOptions(
    question: Record<string, unknown>,
    type: FrontendQuestionType,
    index: number,
  ): string[] {
    if (type === 'yes/no') {
      return ['Yes', 'No'];
    }

    if (type === 'text' || type === 'number' || type === 'rating' || type === 'date') {
      return [];
    }

    const optionSources = [
      question.options,
      question.choices,
      question.answers,
      question.values,
    ];

    const normalizedOptions = optionSources
      .flatMap((source) => (Array.isArray(source) ? source : []))
      .map((option) => {
        if (typeof option === 'string') {
          return option.trim();
        }

        if (option && typeof option === 'object') {
          const record = option as Record<string, unknown>;
          const valueCandidates = [record.label, record.value, record.text, record.name];
          const match = valueCandidates.find(
            (candidate): candidate is string =>
              typeof candidate === 'string' && candidate.trim().length > 0,
          );

          return match?.trim() ?? '';
        }

        return '';
      })
      .filter((option, optionIndex, array): option is string => !!option && array.indexOf(option) === optionIndex);

    if (normalizedOptions.length >= 2) {
      return normalizedOptions;
    }

    return [`Option ${index * 2 + 1}`, `Option ${index * 2 + 2}`];
  }

  private async listNurseResponses(
    authUser: { sub?: string; userId?: string },
    validated?: boolean,
  ): Promise<NurseVisibleResponseItem[]> {
    const nurse = await this.getNurseUser(authUser);
    const patients = await this.userModel
      .find({ assignedDepartment: nurse.assignedDepartment })
      .select('_id firstName lastName email assignedDepartment')
      .exec();

    const patientIds = patients.map((patient) => patient._id.toString());
    if (patientIds.length === 0) {
      return [];
    }

    const query: Record<string, unknown> = {
      patientId: { $in: patientIds },
    };

    if (typeof validated === 'boolean') {
      query.validated = validated;
    }

    const responses = await this.symptomResponseModel
      .find(query)
      .populate('symptomFormId')
      .sort({ createdAt: -1, _id: -1 })
      .exec();

    const patientMap = new Map(patients.map((patient) => [patient._id.toString(), patient]));

    return responses
      .map((response) => {
        const patient = response.patientId ? patientMap.get(response.patientId) : null;
        if (!patient) {
          return null;
        }

        return this.formatNurseResponse(response, patient, false);
      })
      .filter((item): item is NurseVisibleResponseItem => item !== null);
  }

  private async getNurseUser(authUser: { sub?: string; userId?: string }): Promise<UserDocument> {
    const authUserId = this.extractAuthUserId(authUser);

    if (!authUserId || !isValidObjectId(authUserId)) {
      throw new ForbiddenException('Invalid authenticated user');
    }

    const nurse = await this.userModel.findById(authUserId).exec();
    if (!nurse) {
      throw new NotFoundException('Authenticated nurse not found');
    }

    if (!nurse.assignedDepartment?.trim()) {
      throw new ForbiddenException('Nurse department is not configured');
    }

    return nurse;
  }

  private async findVisibleResponseForNurse(
    responseId: string,
    department: string,
  ): Promise<SymptomResponseDocument> {
    if (!responseId || !isValidObjectId(responseId)) {
      throw new BadRequestException('Invalid symptom response id');
    }

    const response = await this.symptomResponseModel
      .findById(responseId)
      .populate('symptomFormId')
      .exec();

    if (!response) {
      throw new NotFoundException(`Symptom response ${responseId} not found`);
    }

    await this.getPatientForVisibleResponse(response, department);

    return response;
  }

  private async getPatientForVisibleResponse(
    response: SymptomResponseDocument,
    department: string,
  ): Promise<UserDocument> {
    const patientId = response.patientId?.trim();

    if (!patientId || !isValidObjectId(patientId)) {
      throw new ForbiddenException('Response has no valid patient reference');
    }

    const patient = await this.userModel
      .findById(patientId)
      .select('_id firstName lastName email assignedDepartment')
      .exec();

    if (!patient) {
      throw new NotFoundException(`Patient ${patientId} not found`);
    }

    if ((patient.assignedDepartment ?? '').trim() !== department.trim()) {
      throw new ForbiddenException('You cannot access responses outside your department');
    }

    return patient;
  }

  private formatNurseResponse(
    response: SymptomResponseDocument,
    patient: UserDocument,
    includeAnswers: boolean,
  ): NurseVisibleResponseItem {
    const form =
      response.symptomFormId &&
      typeof response.symptomFormId === 'object' &&
      'questions' in response.symptomFormId
        ? (response.symptomFormId as unknown as Symptom)
        : null;

    const questionMap = new Map(
      (form?.questions ?? []).map((question) => [question._id?.toString(), question.label]),
    );

    return {
      _id: response._id.toString(),
      patientId: patient._id.toString(),
      patientName: this.buildUserDisplayName(patient),
      patientDepartment: patient.assignedDepartment ?? '',
      submittedAt: response.createdAt ?? response.date,
      vitals: {
        bloodPressure: response.vitals?.bloodPressure ?? null,
        heartRate: response.vitals?.heartRate ?? null,
        temperature: response.vitals?.temperature ?? null,
        weight: response.vitals?.weight ?? null,
      },
      validated: response.validated ?? false,
      validatedBy: response.validatedBy ?? null,
      validatedByName: response.validatedByName ?? null,
      validatedAt: response.validatedAt ?? null,
      validationNote: response.validationNote ?? '',
      issueReported: response.issueReported ?? false,
      ...(includeAnswers
        ? {
            formId:
              response.symptomFormId instanceof Types.ObjectId
                ? response.symptomFormId.toString()
                : (response.symptomFormId as Symptom & { _id?: Types.ObjectId })?._id?.toString(),
            answers: response.answers.map((answer) => ({
              question: questionMap.get(answer.questionId) ?? answer.questionId,
              answer: answer.value,
            })),
          }
        : {}),
    };
  }

  private buildUserDisplayName(
    user: Pick<UserDocument, 'firstName' | 'lastName' | 'email'>,
  ): string {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return fullName || user.email || 'Unknown user';
  }

  private extractAuthUserId(authUser: { sub?: string; userId?: string } | null | undefined): string {
    return authUser?.sub ?? authUser?.userId ?? '';
  }

  private extractVitals(
    symptomForm: Symptom,
    answers: Array<{ questionId: string; value: string | number | boolean | string[] | null }>,
  ): SymptomVitalsView {
    const questionMap = new Map(
      symptomForm.questions.map((question) => [question._id?.toString(), question.label.toLowerCase()]),
    );

    const vitals: SymptomVitalsView = {
      bloodPressure: null,
      heartRate: null,
      temperature: null,
      weight: null,
    };

    for (const answer of answers) {
      const label = questionMap.get(answer.questionId) ?? '';

      if (!label) {
        continue;
      }

      if (!vitals.bloodPressure && (label.includes('blood pressure') || label === 'bp')) {
        vitals.bloodPressure = this.stringifyAnswerValue(answer.value);
      }

      if (vitals.heartRate === null && (label.includes('heart rate') || label.includes('pulse'))) {
        vitals.heartRate = this.toNullableNumber(answer.value);
      }

      if (vitals.temperature === null && label.includes('temp')) {
        vitals.temperature = this.toNullableNumber(answer.value);
      }

      if (vitals.weight === null && label.includes('weight')) {
        vitals.weight = this.toNullableNumber(answer.value);
      }
    }

    return vitals;
  }

  private toNullableNumber(value: string | number | boolean | string[] | null): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private stringifyAnswerValue(value: string | number | boolean | string[] | null): string | null {
    if (typeof value === 'string') {
      return value.trim() || null;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value.join(', ').trim() || null;
    }

    return null;
  }

  private normalizeDate(date: Date): Date {
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date');
    }

    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private getStartOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private getEndOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  }
}
