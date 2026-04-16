// src/ai-analysis/analysis.controller.ts
import { Controller, Post, Get, Body, Param, BadRequestException } from '@nestjs/common';
import { AnalysisService } from './analysis.service';

@Controller('ai-analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post('generate')
  async generateAnalysis(@Body() body: any) {
    const patientId = body.patientId || body.patient_id;
    const answers = body.answers;

    if (!patientId) {
      throw new BadRequestException('patientId is required');
    }
    if (!Array.isArray(answers) || answers.length === 0) {
      throw new BadRequestException('answers must be a non-empty array');
    }

    return this.analysisService.generateFromFormAnswers(patientId, answers);
  }

  @Get('patient/:patientId')
  async getByPatient(@Param('patientId') patientId: string) {
    return this.analysisService.getAnalysesByPatient(patientId);
  }

  @Get('patient/:patientId/latest')
  async getLatest(@Param('patientId') patientId: string) {
    return this.analysisService.getLatestByPatient(patientId);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.analysisService.getAnalysisById(id);
  }
}