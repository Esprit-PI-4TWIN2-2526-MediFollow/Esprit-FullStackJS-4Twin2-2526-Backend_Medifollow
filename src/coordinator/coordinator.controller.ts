import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/users/auth/jwt.guard';
import { CoordinatorService } from './coordinator.service';

@Controller('coordinator')
@UseGuards(JwtAuthGuard)
export class CoordinatorController {
  constructor(private readonly coordinatorService: CoordinatorService) {}

  @Get('dashboard')
  getDashboard(@Req() req, @Query('range') range?: string) {
    return this.coordinatorService.getDashboard(req.user, range);
  }

  @Get('follow-up/protocol')
  getFollowUpProtocol(@Req() req) {
    return this.coordinatorService.getFollowUpProtocol(req.user);
  }

  @Get('follow-up/protocol/:patientId')
  getPatientFollowUpProtocol(@Req() req, @Param('patientId') patientId: string) {
    return this.coordinatorService.getPatientFollowUpProtocol(req.user, patientId);
  }
}
