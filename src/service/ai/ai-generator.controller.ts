import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AiGeneratorService } from './ai-generator.service';
import { GenerateServiceDto } from './generate-service.dto';
 
@Controller('services')
export class AiGeneratorController {
  constructor(private readonly aiGeneratorService: AiGeneratorService) {}
 
  @Post('ai-generate')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  generate(@Body() dto: GenerateServiceDto) {
    return this.aiGeneratorService.generateService(dto.description);
  }
}