import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // 1️⃣ KPI SUMMARY
  @Get('summary')
  async getSummary() {
    return this.dashboardService.getSummary();
  }

  // 2️⃣ ACTIVITÉ DE SUIVI DANS LE TEMPS
  @Get('followup-activity')
  async getFollowupActivity(@Query('range') range: string) {
    return this.dashboardService.getFollowupActivity(range);
  }

  // 3️⃣ PATIENTS PAR SERVICE
  @Get('patients-by-service')
  async getPatientsByService() {
    return this.dashboardService.getPatientsByService();
  }

  // 4️⃣ COMPLIANCE PAR SERVICE
  @Get('compliance-by-service')
  async getComplianceByService() {
    return this.dashboardService.getComplianceByService();
  }

  // 5️⃣ STATISTIQUES QUESTIONNAIRES
  @Get('questionnaires-stats')
  async getQuestionnairesStats() {
    return this.dashboardService.getQuestionnairesStats();
  }

  // 6️⃣ PATIENTS À RISQUE
  @Get('high-risk-patients')
  async getHighRiskPatients() {
    return this.dashboardService.getHighRiskPatients();
  }


  // 8️⃣ ALERTS
  @Get('alerts')
  async getAlerts() {
    return this.dashboardService.getAlerts();
  }

  // 9️⃣ AI INSIGHTS
  @Get('ai-insights')
  async getAIInsights() {
    return this.dashboardService.getAIInsightsDynamic();
  }

  // 🔟 PATIENTS INACTIFS
  @Get('inactive-patients')
  async getInactivePatients() {
    return this.dashboardService.getInactivePatients();
  }

  // ⚙️ OPTIONAL DEV ENDPOINTS (peuvent être supprimés si pas besoin)
  @Get('server-health')
  async getServerHealth() {
    return this.dashboardService.getServerHealth();
  }

  @Get('security-stats')
  async getSecurityStats() {
    return this.dashboardService.getSecurityStats();
  }

  // 11️⃣ SERVICES OVERVIEW
  @Get('services-overview')
  async getServicesOverview() {
    return this.dashboardService.getServicesOverview();
  }
}
