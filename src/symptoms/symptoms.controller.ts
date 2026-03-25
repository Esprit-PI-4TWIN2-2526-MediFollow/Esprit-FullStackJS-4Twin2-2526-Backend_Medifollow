import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { SymptomsService } from './symptoms.service';
import { CreateSymptomDto } from './dto/create-symptom.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';
import { GenerateSymptomDto } from './dto/generate-symptom.dto';
import { UpdateSymptomDto } from './dto/update-symptom.dto';
import { ResponseActionDto } from './dto/response-action.dto';
import { JwtAuthGuard } from 'src/users/auth/jwt.guard';

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

  @Get('response/by-date/:date')
  @UseGuards(JwtAuthGuard)
  getByDate(@Param('date') date: string, @Req() req) {
    return this.service.getByDate(this.getRequestUserId(req), date);
  }

  @Get('response/:patientId')
  getPatientResponses(@Param('patientId') patientId: string) {
    return this.service.getPatientResponses(patientId);
  }

  @Get('nurse/responses')
  @UseGuards(JwtAuthGuard)
  getNurseResponses(@Req() req) {
    return this.service.getNurseResponses(req.user);
  }

  @Get('nurse/responses/pending')
  @UseGuards(JwtAuthGuard)
  getPendingNurseResponses(@Req() req) {
    return this.service.getPendingNurseResponses(req.user);
  }

  @Get('nurse/responses/validated')
  @UseGuards(JwtAuthGuard)
  getValidatedNurseResponses(@Req() req) {
    return this.service.getValidatedNurseResponses(req.user);
  }

  @Get('nurse/responses/:id')
  @UseGuards(JwtAuthGuard)
  getNurseResponseById(@Param('id') id: string, @Req() req) {
    return this.service.getNurseResponseById(req.user, id);
  }

  @Post('nurse/responses/:id/validate')
  @UseGuards(JwtAuthGuard)
  validateResponse(@Param('id') id: string, @Body() dto: ResponseActionDto, @Req() req) {
    return this.service.validateResponse(req.user, id, dto);
  }

  @Post('nurse/responses/:id/report-issue')
  @UseGuards(JwtAuthGuard)
  reportIssue(@Param('id') id: string, @Body() dto: ResponseActionDto, @Req() req) {
    return this.service.reportIssue(req.user, id, dto);
  }

  @Post('generate')
  generate(@Body() dto: GenerateSymptomDto) {
    return this.service.generateQuestions(dto);
  }

  private getRequestUserId(req: any): string {
    return req?.user?.sub ?? req?.user?.userId;
  }
}
