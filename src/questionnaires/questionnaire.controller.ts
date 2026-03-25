import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query
} from '@nestjs/common';
import { QuestionnaireService } from './questionnaire.service';
import { CreateQuestionnaireDto } from './dto/create-questionnaire.dto';
import { UpdateQuestionnaireDto } from './dto/update-questionnaire.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';

@Controller('questionnaires')
export class QuestionnaireController {

  constructor(private readonly service: QuestionnaireService) {}

  // ── Questionnaires ──────────────────────────────────────

  @Post()
  create(@Body() dto: CreateQuestionnaireDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query('medicalService') medicalService?: string) {
    return this.service.findAll(medicalService);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQuestionnaireDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Patch(':id/toggle-status')
  toggleStatus(@Param('id') id: string) {
    return this.service.toggleStatus(id);
  }

  @Patch(':id/archive')
  async archive(@Param('id') id: string) {
    return this.service.archive(id);
  }

  @Patch(':id/restore')
  async restore(@Param('id') id: string) {
    return this.service.restore(id);
  }

  // ── Questions ────────────────────────────────────────────

  @Post(':id/questions')
  addQuestion(
    @Param('id') id: string,
    @Body() dto: CreateQuestionDto
  ) {
    return this.service.addQuestion(id, dto);
  }
//reorder questions selon ordre
   @Patch(':id/questions/reorder')
  reorderQuestions(
    @Param('id') id: string,
    @Body() body: { orderedIds: string[] }
  ) {
    return this.service.reorderQuestions(id, body.orderedIds);
  }

  @Patch(':id/questions/:questionId')
  updateQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() dto: Partial<CreateQuestionDto>
  ) {
    return this.service.updateQuestion(id, questionId, dto);
  }

  @Delete(':id/questions/:questionId')
  removeQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string
  ) {
    return this.service.removeQuestion(id, questionId);
  }

 

  // ── Réponses ─────────────────────────────────────────────

  @Post(':id/responses')
  submitResponse(
    @Param('id') questionnaireId: string,
    @Body() dto: SubmitResponseDto & { patientId: string }
  ) {
    return this.service.submitResponse(questionnaireId, dto.patientId, dto);
  }

  @Get(':id/responses')
  getResponses(@Param('id') id: string) {
    return this.service.getResponses(id);
  }

  @Get('patient/:patientId/responses')
  getPatientResponses(@Param('patientId') patientId: string) {
    return this.service.getPatientResponses(patientId);
  }
}