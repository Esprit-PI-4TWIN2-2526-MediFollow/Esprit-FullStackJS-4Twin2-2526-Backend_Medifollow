import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SymptomsService } from './symptoms.service';
import { CreateSymptomDto } from './dto/create-symptom.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';
import { GenerateSymptomDto } from './dto/generate-symptom.dto';

@Controller('symptoms')
export class SymptomsController {
  constructor(private readonly service: SymptomsService) {}

  @Post('form')
  create(@Body() dto: CreateSymptomDto) {
    return this.service.create(dto);
  }

  @Get('form')
  findAll() {
    return this.service.findAll();
  }

  @Get('form/latest')
  getLatestActive() {
    return this.service.getLatestActive();
  }

  @Post('response')
  submitResponse(@Body() dto: SubmitResponseDto) {
    return this.service.submitResponse(dto);
  }

  @Get('response/:patientId')
  getPatientResponses(@Param('patientId') patientId: string) {
    return this.service.getPatientResponses(patientId);
  }

  @Post('generate')
  generate(@Body() dto: GenerateSymptomDto) {
    return this.service.generateQuestions(dto);
  }
}
