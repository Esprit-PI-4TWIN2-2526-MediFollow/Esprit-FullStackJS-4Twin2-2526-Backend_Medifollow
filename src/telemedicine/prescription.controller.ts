import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrescriptionService } from './prescription.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { JwtAuthGuard } from '../users/auth/jwt.guard';

@Controller('prescriptions')
@UseGuards(JwtAuthGuard)
export class PrescriptionController {
  constructor(private readonly prescriptionService: PrescriptionService) {}

  @Post()
  create(@Body() dto: CreatePrescriptionDto) {
    return this.prescriptionService.create(dto);
  }

  @Get()
  findAll(
    @Query('patientId') patientId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('consultationId') consultationId?: string,
    @Query('status') status?: string,
  ) {
    return this.prescriptionService.findAll({
      patientId,
      doctorId,
      consultationId,
      status,
    });
  }

  @Get('qr/:qrCode')
  findByQRCode(@Param('qrCode') qrCode: string) {
    return this.prescriptionService.findByQRCode(qrCode);
  }

  @Get('patient/:patientId')
  findByPatient(@Param('patientId') patientId: string) {
    return this.prescriptionService.findByPatient(patientId);
  }

  @Get('consultation/:consultationId')
  findByConsultation(@Param('consultationId') consultationId: string) {
    return this.prescriptionService.findByConsultation(consultationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prescriptionService.findOne(id);
  }

  @Post(':id/issue')
  issue(@Param('id') id: string, @Body('digitalSignature') digitalSignature: string) {
    return this.prescriptionService.issue(id, digitalSignature);
  }

  @Post(':id/send')
  markAsSent(@Param('id') id: string) {
    return this.prescriptionService.markAsSent(id);
  }

  @Post(':id/dispense')
  markAsDispensed(@Param('id') id: string) {
    return this.prescriptionService.markAsDispensed(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.prescriptionService.delete(id);
  }
}
