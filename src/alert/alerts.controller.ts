import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AlertsService } from './alerts.service';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // si tu as une authentification

@Controller('alerts')
export class AlertsController {

  constructor(private readonly alertsService: AlertsService) {}

  // Tester facilement : toutes les alertes d'un patient
  @Get('patient/:patientId')
  async getPatientAlerts(@Param('patientId') patientId: string) {
    return this.alertsService.getAlertsByPatient(patientId);
  }

  // alert.controller.ts

@Get(':id')
async getAlertById(@Param('id') id: string) {
  return this.alertsService.findOne(id);
}

  // Alertes non lues pour un médecin (à utiliser dans le dashboard médecin)
  @Get('doctor/:doctorId/unread')
async getDoctorUnreadAlerts(@Param('doctorId') doctorId: string) {
  console.log('🔍 Searching alerts for doctorId:', doctorId);
  const alerts = await this.alertsService.getUnreadAlertsForDoctor(doctorId);
  console.log('📋 Alerts found:', alerts.length);
  return alerts;
}

  // Marquer une alerte comme lue
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    return this.alertsService.markAsRead(id);
  }
}