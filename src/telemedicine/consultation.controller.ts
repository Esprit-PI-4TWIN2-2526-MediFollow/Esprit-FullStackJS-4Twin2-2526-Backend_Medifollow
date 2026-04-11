import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConsultationService } from './consultation.service';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { UpdateConsultationDto } from './dto/update-consultation.dto';
import { JwtAuthGuard } from '../users/auth/jwt.guard';

@Controller('consultations')
@UseGuards(JwtAuthGuard)
export class ConsultationController {
  constructor(private readonly consultationService: ConsultationService) {}

  @Post()
  create(@Body() dto: CreateConsultationDto) {
    return this.consultationService.create(dto);
  }

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('patientId') patientId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.consultationService.findAll({
      status,
      patientId,
      doctorId,
      startDate,
      endDate,
    });
  }

  @Get('doctor/:doctorId')
  findByDoctor(@Param('doctorId') doctorId: string) {
    return this.consultationService.findByDoctor(doctorId);
  }

  @Get('doctor/:doctorId/today')
  getTodayConsultations(@Param('doctorId') doctorId: string) {
    return this.consultationService.getTodayConsultations(doctorId);
  }

  @Get('doctor/:doctorId/upcoming')
  getUpcomingConsultations(
    @Param('doctorId') doctorId: string,
    @Query('days') days?: string,
  ) {
    const daysNumber = days ? parseInt(days, 10) : 7;
    return this.consultationService.getUpcomingConsultations(doctorId, daysNumber);
  }

  @Get('patient/:patientId')
  findByPatient(@Param('patientId') patientId: string) {
    return this.consultationService.findByPatient(patientId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.consultationService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateConsultationDto) {
    return this.consultationService.update(id, dto);
  }

  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.consultationService.start(id);
  }

  @Post(':id/end')
  end(
    @Param('id') id: string,
    @Body('notes') notes?: string,
    @Body('diagnosis') diagnosis?: string,
  ) {
    return this.consultationService.end(id, notes, diagnosis);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.consultationService.cancel(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.consultationService.delete(id);
  }
}
