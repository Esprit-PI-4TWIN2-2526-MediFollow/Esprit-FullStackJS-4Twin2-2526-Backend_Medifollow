import {
  BadRequestException,
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
  ) {}

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async create(dto: CreateSymptomDto): Promise<Symptom> {
    const questions = this.normalizeQuestions(dto.questions ?? []);

    if (dto.isActive !== false) {
      await this.symptomModel.updateMany({ isActive: true }, { $set: { isActive: false } }).exec();
    }

    const symptom = new this.symptomModel({
      title: dto.title.trim(),
      questions,
      isActive: dto.isActive ?? true,
    });

    return symptom.save();
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

  async submitResponse(dto: SubmitResponseDto): Promise<SymptomResponse> {
    if (!dto.formId || !isValidObjectId(dto.formId)) {
      throw new BadRequestException('Invalid formId');
    }

    if (dto.patientId && !isValidObjectId(dto.patientId)) {
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
      ...(dto.patientId ? { patientId: new Types.ObjectId(dto.patientId) } : {}),
      answers: normalizedAnswers,
    });

    return response.save();
  }

  async getPatientResponses(patientId: string): Promise<SymptomResponse[]> {
    if (!patientId || !isValidObjectId(patientId)) {
      throw new BadRequestException('Invalid patientId');
    }

    return this.symptomResponseModel
      .find({ patientId: new Types.ObjectId(patientId) })
      .populate('symptomFormId', 'title isActive')
      .sort({ createdAt: -1 })
      .exec();
  }

  // ── AI Question Generation ────────────────────────────────────────────────────

  async generateQuestions(dto: GenerateSymptomDto): Promise<{ questions: CreateQuestionDto[] }> {
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
  "type":     "<one of: text | number | scale | single_choice | multiple_choice | date | boolean>",
  "order":    <integer starting at 0>,
  "required": <true | false>,
  "options":  ["<option 1>", "<option 2>", ...]   ← always present, empty [] when not applicable
}

=== TYPE SELECTION RULES ===
• "number"          → measurable numeric vitals: temperature (°C), heart rate (bpm),
                      oxygen saturation (%), blood pressure (e.g. 120/80), weight (kg),
                      drain output (mL), pain numeric score when you need a raw number.
• "scale"           → subjective intensity rated 1-10: pain, fatigue, nausea, anxiety,
                      breathlessness, mood — anything the patient self-rates.
• "boolean"         → simple yes/no observations: dressing changed, fever present,
                      medication taken, wound oozing, vomiting occurred, able to walk.
• "single_choice"   → one answer from a fixed list: wound appearance (clean / red /
                      swollen / discharge), stool consistency (Bristol scale), mobility
                      level, diet tolerance.
• "multiple_choice" → one or more answers from a list: associated symptoms (nausea AND
                      dizziness AND headache), location of pain.
• "date"            → last dressing change date, last bowel movement date, date of
                      symptom onset.
• "text"            → open descriptions: nature of discharge, additional comments,
                      anything that cannot be captured by the above types.

=== CLINICAL DEPTH RULES ===
1. Always include at least ONE vital-sign question relevant to the service
   (temperature, SpO2, heart rate, blood pressure, weight…).
2. Always include at least ONE dressing / wound-care question when the service
   involves surgical or skin management (Surgery, Orthopedics, Dermatology, Oncology).
3. Always include at least ONE pain question using "scale" type.
4. For boolean questions about actions (dressing changed? medication taken?),
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

      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new SyntaxError('No JSON array found in the response');

      const parsed    = JSON.parse(jsonMatch[0]) as CreateQuestionDto[];
      const questions = this.normalizeQuestions(parsed);

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
}
