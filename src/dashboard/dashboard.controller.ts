import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('followup-activity')
  async getFollowupActivity(@Query('range') range: string) {
    return this.dashboardService.getFollowupActivity(range);
  }

  @Get('patients-by-service')
  async getPatientsByService() {
    return this.dashboardService.getPatientsByService();
  }

  @Get('compliance-by-service')
  async getComplianceByService() {
    return this.dashboardService.getComplianceByService();
  }

  @Get('questionnaires-stats')
  async getQuestionnairesStats() {
    return this.dashboardService.getQuestionnairesStats();
  }

  @Get('high-risk-patients')
  async getHighRiskPatients() {
    return this.dashboardService.getHighRiskPatients();
  }

  @Get('global-followup-rate')
  async getGlobalFollowupRate() {
    return this.dashboardService.getGlobalFollowupRate();
  }

  @Get('alerts')
  async getAlerts() {
    return this.dashboardService.getAlerts();
  }

  @Get('ai-insights')
  async getAIInsights() {
    return this.dashboardService.getAIInsightsDynamic();
  }

  @Get('inactive-patients')
  async getInactivePatients() {
    return this.dashboardService.getInactivePatients();
  }

  @Get('server-health')
  async getServerHealth() {
    return this.dashboardService.getServerHealth();
  }

  @Get('security-stats')
  async getSecurityStats() {
    return this.dashboardService.getSecurityStats();
  }

  @Get('services-overview')
  async getServicesOverview() {
    return this.dashboardService.getServicesOverview();
  }
}
