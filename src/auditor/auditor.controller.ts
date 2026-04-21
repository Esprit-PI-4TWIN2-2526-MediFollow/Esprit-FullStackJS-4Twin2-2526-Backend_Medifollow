import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditorService } from './auditor.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { JwtAuthGuard } from 'src/users/auth/jwt.guard';
import { RolesGuard } from 'src/role/guard/role.guard';
import { Roles } from 'src/role/decorator/role.decorator';

@Controller('api/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  'auditor',
  'Auditor',
  'AUDITOR',
)
export class AuditorController {
  constructor(private readonly auditorService: AuditorService) {}

  @Get('logs')
  getLogs(@Query() query: QueryAuditLogsDto) {
    return this.auditorService.findLogs(query);
  }

  @Get('report')
  getReport(@Query() query: QueryAuditLogsDto) {
    return this.auditorService.generateReport(query);
  }
}
