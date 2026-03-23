import { Body, Controller, Get, Post } from '@nestjs/common';
import { SymptomsService } from './symptoms.service';
import { CreateSymptomDto } from './dto/create-symptom.dto';

@Controller('symptoms')
export class SymptomsController {

  constructor(private readonly service: SymptomsService) {}

  // ADMIN
  @Post('form')
  create(@Body() dto: CreateSymptomDto) {
    return this.service.create(dto);
  }

  // ADMIN
  @Get('form')
  findAll() {
    return this.service.findAll();
  }

  // PATIENT
  @Get('form/latest')
  getLatest() {
    return this.service.getLatest();
  }
}