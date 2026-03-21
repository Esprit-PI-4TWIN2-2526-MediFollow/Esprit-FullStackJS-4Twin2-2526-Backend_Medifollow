import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';

export class GenerateQuestionsDto {
  medicalService: string;
  title: string;
  description?: string;
  count?: number;
}

@Controller('ai')
export class AiController {

  constructor(private readonly aiService: AiService) {}

  @Post('generate-questions')
  async generateQuestions(@Body() dto: GenerateQuestionsDto) {
    const questions = await this.aiService.generateQuestions(
      dto.medicalService,
      dto.title,
      dto.description || '',
      dto.count || 7
    );
    return { questions };
  }
}