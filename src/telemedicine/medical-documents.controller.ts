import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MedicalDocumentsService } from './medical-documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { JwtAuthGuard } from '../users/auth/jwt.guard';

@Controller('medical-documents')
@UseGuards(JwtAuthGuard)
export class MedicalDocumentsController {
  constructor(private readonly documentsService: MedicalDocumentsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @Req() req: any,
  ) {
    const uploadedById = req.user.userId || req.user.sub;
    return this.documentsService.upload(file, dto, uploadedById);
  }

  @Get()
  findAll(
    @Query('patientId') patientId?: string,
    @Query('consultationId') consultationId?: string,
    @Query('type') type?: string,
    @Query('uploadedById') uploadedById?: string,
  ) {
    return this.documentsService.findAll({
      patientId,
      consultationId,
      type,
      uploadedById,
    });
  }

  @Get('patient/:patientId')
  findByPatient(@Param('patientId') patientId: string) {
    return this.documentsService.findByPatient(patientId);
  }

  @Get('consultation/:consultationId')
  findByConsultation(@Param('consultationId') consultationId: string) {
    return this.documentsService.findByConsultation(consultationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Patch(':id/share')
  share(@Param('id') id: string, @Body('userIds') userIds: string[]) {
    return this.documentsService.share(id, userIds);
  }

  @Patch(':id/unshare')
  unshare(@Param('id') id: string, @Body('userId') userId: string) {
    return this.documentsService.unshare(id, userId);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.documentsService.delete(id);
  }
}
