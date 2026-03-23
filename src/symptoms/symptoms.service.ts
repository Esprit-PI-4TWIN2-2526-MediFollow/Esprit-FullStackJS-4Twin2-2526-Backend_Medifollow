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

  async submitResponse(dto: SubmitResponseDto): Promise<SymptomResponse> {
    if (!dto.patientId || !isValidObjectId(dto.patientId)) {
      throw new BadRequestException('Invalid patientId');
    }

    const activeSymptom = await this.symptomModel
      .findOne({ isActive: true })
      .sort({ createdAt: -1 })
      .exec();
    if (!activeSymptom) {
      throw new NotFoundException('No active symptom form found');
    }

    const response = new this.symptomResponseModel({
      symptomFormId: new Types.ObjectId(activeSymptom.id),
      patientId: new Types.ObjectId(dto.patientId),
      answers: dto.answers,
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

  async generateQuestions(dto: GenerateSymptomDto): Promise<{ questions: CreateQuestionDto[] }> {
    const title = dto.title?.trim();
    const description = dto.description?.trim() ?? '';
    const numberOfQuestions = dto.numberOfQuestions ?? 7;

    if (!title) {
      throw new BadRequestException('title is required');
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You generate symptom follow-up form questions for a healthcare application.
Return ONLY a valid JSON array.
The JSON array must contain question objects with this exact structure:
[{"label":"...","type":"text","order":0,"required":true,"options":[]}]

Allowed question types only:
text, number, scale, single_choice, multiple_choice, date, boolean

Rules:
- Keep questions concise and medically relevant.
- Use "scale" for symptom intensity when appropriate.
- Use "boolean" for yes/no questions.
- Use "single_choice" or "multiple_choice" only when options are necessary.
- Always include "order".
- Always include "required".
- Always include "options" as an array, even if empty.
- Do not include markdown or explanations.`,
          },
          {
            role: 'user',
            content: `Generate exactly ${numberOfQuestions} questions for a symptom follow-up form.

Title: ${title}
Description: ${description || 'Symptom follow-up form'}

Return raw JSON only.`,
          },
        ],
        temperature: 0.4,
        max_tokens: 1500,
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? '';
      if (!raw) {
        throw new InternalServerErrorException('Empty response from AI model');
      }

      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new SyntaxError('No JSON array found in the response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as CreateQuestionDto[];
      const questions = this.normalizeQuestions(parsed);

      return { questions };
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof InternalServerErrorException) {
        throw err;
      }
      if (err instanceof SyntaxError) {
        throw new InternalServerErrorException('AI response is not valid JSON');
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new InternalServerErrorException(`AI generation error: ${message}`);
    }
  }

  private normalizeQuestions(questions: CreateQuestionDto[]): CreateQuestionDto[] {
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
        ? question.options.map((option) => option?.trim()).filter((option): option is string => !!option)
        : [];

      return {
        ...question,
        label: question.label.trim(),
        type: question.type.trim(),
        order: question.order ?? index,
        required: question.required ?? false,
        options,
      };
    });
  }
}
