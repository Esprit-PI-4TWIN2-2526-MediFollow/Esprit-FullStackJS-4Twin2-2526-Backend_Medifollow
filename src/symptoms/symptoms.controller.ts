import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { SymptomsService } from './symptoms.service';
import { CreateSymptomDto } from './dto/create-symptom.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';
import { GenerateSymptomDto } from './dto/generate-symptom.dto';
import { UpdateSymptomDto } from './dto/update-symptom.dto';

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

  @Get('form/patient/:patientId')
  findFormByPatient(@Param('patientId') patientId: string) {
    return this.service.findFormByPatient(patientId);
  }

  @Get('form/:id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Put('form/:id')
  update(@Param('id') id: string, @Body() dto: UpdateSymptomDto) {
    return this.service.update(id, dto);
  }

  @Delete('form/:id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('response')
  createResponse(@Body() dto: SubmitResponseDto) {
    console.log('RECEIVED DTO:', dto);
    return this.service.saveResponse(dto);
  }

  @Get('response/today/:patientId')
  getTodayResponse(@Param('patientId') patientId: string) {
    return this.service.getTodayResponse(patientId);
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
