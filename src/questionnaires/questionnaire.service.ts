import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Questionnaire, QuestionnaireDocument } from './schemas/questionnaire.schema';
import { QuestionnaireResponse, QuestionnaireResponseDocument } from './schemas/questionnaire-response.schema';
import { CreateQuestionnaireDto } from './dto/create-questionnaire.dto';
import { UpdateQuestionnaireDto } from './dto/update-questionnaire.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';

@Injectable()
export class QuestionnaireService {

  constructor(
    @InjectModel(Questionnaire.name)
    private questionnaireModel: Model<QuestionnaireDocument>,

    @InjectModel(QuestionnaireResponse.name)
    private responseModel: Model<QuestionnaireResponseDocument>,
  ) {}

  // ── Questionnaires ──────────────────────────────────────

  async create(dto: CreateQuestionnaireDto): Promise<Questionnaire> {
    const questionnaire = new this.questionnaireModel(dto);
    return questionnaire.save();
  }

  //find questionnaire by service
  async findAll(medicalService?: string): Promise<Questionnaire[]> {
    const filter = medicalService ? { medicalService } : {};
    return this.questionnaireModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  //find by id
  async findOne(id: string): Promise<Questionnaire> {
    const questionnaire = await this.questionnaireModel.findById(id).exec();
    if (!questionnaire) throw new NotFoundException(`Questionnaire ${id} introuvable`);
    return questionnaire;
  }

  //update
  async update(id: string, dto: UpdateQuestionnaireDto): Promise<Questionnaire> {
    const updated = await this.questionnaireModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!updated) throw new NotFoundException(`Questionnaire ${id} introuvable`);
    return updated;
  }

  //delete
  async remove(id: string): Promise<void> {
    const result = await this.questionnaireModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException(`Questionnaire ${id} introuvable`);
  }

  // changer status 
  async toggleStatus(id: string): Promise<Questionnaire> {
    const q = await this.questionnaireModel.findById(id).exec();
    if (!q) throw new NotFoundException(`Questionnaire ${id} introuvable`);
    q.status = q.status === 'active' ? 'inactive' : 'active';
    return q.save();
  }

  // ── Questions ────────────────────────────────────────────

  //ajout
  async addQuestion(id: string, dto: CreateQuestionDto): Promise<Questionnaire> {
    const q = await this.questionnaireModel.findById(id).exec();
    if (!q) throw new NotFoundException(`Questionnaire ${id} introuvable`);

    // order automatique si non fourni
    const order = dto.order ?? q.questions.length;
    q.questions.push({ ...dto, order } as any);
    return q.save();
  }

  //update
  async updateQuestion(
    id: string,
    questionId: string,
    dto: Partial<CreateQuestionDto>
  ): Promise<Questionnaire> {
    const q = await this.questionnaireModel.findById(id).exec();
    if (!q) throw new NotFoundException(`Questionnaire ${id} introuvable`);

    const question = q.questions.find(qu => qu['_id'].toString() === questionId);
    if (!question) throw new NotFoundException(`Question ${questionId} introuvable`);

    Object.assign(question, dto);
    return q.save();
  }

  //remove

  async removeQuestion(id: string, questionId: string): Promise<Questionnaire> {
    const q = await this.questionnaireModel.findById(id).exec();
    if (!q) throw new NotFoundException(`Questionnaire ${id} introuvable`);

    q.questions = q.questions.filter(qu => qu['_id'].toString() !== questionId);
    // Réindexer l'ordre
    q.questions.forEach((qu, index) => { qu.order = index; });
    return q.save();
  }

  //reorder questions

  async reorderQuestions(id: string, orderedIds: string[]): Promise<Questionnaire> {
    const q = await this.questionnaireModel.findById(id).exec();
    if (!q) throw new NotFoundException(`Questionnaire ${id} introuvable`);

    orderedIds.forEach((qId, index) => {
      const question = q.questions.find(qu => qu['_id'].toString() === qId);
      if (question) question.order = index;
    });

    q.questions.sort((a, b) => a.order - b.order);
    return q.save();
  }

  // ── Réponses ─────────────────────────────────────────────

  async submitResponse(
    questionnaireId: string,
    patientId: string,
    dto: SubmitResponseDto
  ): Promise<QuestionnaireResponse> {
    const q = await this.questionnaireModel.findById(questionnaireId).exec();
    if (!q) throw new NotFoundException(`Questionnaire ${questionnaireId} introuvable`);

    const response = new this.responseModel({
      questionnaireId: new Types.ObjectId(questionnaireId),
      patientId: new Types.ObjectId(patientId),
      answers: dto.answers,
      notes: dto.notes,
    });

    // Incrémenter le compteur
    await this.questionnaireModel.findByIdAndUpdate(
      questionnaireId,
      { $inc: { responsesCount: 1 } }
    ).exec();

    return response.save();
  }

  async getResponses(questionnaireId: string): Promise<QuestionnaireResponse[]> {
    return this.responseModel
      .find({ questionnaireId: new Types.ObjectId(questionnaireId) })
      .populate('patientId', 'firstName lastName email avatarUrl profileImageName')
      .sort({ createdAt: -1 })
      .exec();
  }

  //retourner les réponses d'un patient

  async getPatientResponses(patientId: string): Promise<QuestionnaireResponse[]> {
    return this.responseModel
      .find({ patientId: new Types.ObjectId(patientId) })
      .populate('questionnaireId', 'title medicalService')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Archiver un questionnaire
   */
  async archive(id: string): Promise<Questionnaire> {
    const questionnaire = await this.questionnaireModel.findByIdAndUpdate(
      id,
      {
        status: 'archived',
        archivedAt: new Date(),
      },
      { new: true }   // Retourne le document mis à jour
    ).exec();

    if (!questionnaire) {
      throw new NotFoundException(`Questionnaire with ID ${id} not found`);
    }

    return questionnaire;
  }

  /**
   *  Restaurer un questionnaire archivé
   */
  async restore(id: string): Promise<Questionnaire> {
    const questionnaire = await this.questionnaireModel.findByIdAndUpdate(
      id,
      {
        status: 'active',        // ou 'inactive' 
        archivedAt: null,
      },
      { new: true }
    ).exec();

    if (!questionnaire) {
      throw new NotFoundException(`Questionnaire with ID ${id} not found`);
    }

    return questionnaire;
  }
}