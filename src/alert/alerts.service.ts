import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Alert } from './schemas/alert.schema';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AlertsService {
  // URL for ML alert prediction service
  private readonly fastApiUrl = process.env.ML_SERVICE_URL || 'https://ml-service-vkpy.onrender.com';

  constructor(
    @InjectModel(Alert.name) private alertModel: Model<Alert>,
    private readonly httpService: HttpService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  async checkAndCreateAlert(
    patientId: string,
    responseId: string,
    vitals: any,
    doctorId?: string
  ) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.fastApiUrl}/predict-alert`, vitals)
      );

      const alertData = response.data;

      if (alertData.hasAlert) {
        const newAlert = new this.alertModel({
          patient: new Types.ObjectId(patientId),
          response: new Types.ObjectId(responseId),
          severity: alertData.severity,
          alertProbability: alertData.alertProbability,
          doctorId: doctorId ? new Types.ObjectId(doctorId) : null,
          isRead: false,
        });

        await newAlert.save();

        console.log(`🚨 Alerte ${alertData.severity.toUpperCase()} créée pour le patient ${patientId}`);

        // === CREATE NOTIFICATION FOR DOCTOR ===
        if (doctorId) {
          try {
            const patient = await this.usersService.findOne(patientId);
            
            if (patient) {
              const priorityMap = {
                'critical': 'urgent',
                'high': 'high',
                'medium': 'medium',
                'low': 'low'
              };

              const titleMap = {
                'critical': '🚨 CRITICAL ALERT',
                'high': '⚠️ High Priority Alert',
                'medium': '⚡ Medium Alert',
                'low': 'ℹ️ Low Alert'
              };

              await this.notificationsService.create({
                recipientId: doctorId,
                type: 'alert',
                priority: priorityMap[alertData.severity] || 'high',
                title: titleMap[alertData.severity] || 'Patient Alert',
                message: `${patient.firstName} ${patient.lastName} has a ${alertData.severity} severity alert (${Math.round(alertData.alertProbability * 100)}% probability)`,
                data: {
                  alertId: newAlert._id.toString(),
                  severity: alertData.severity,
                  probability: alertData.alertProbability,
                  vitals: vitals,
                },
                patientId: patientId,
                actionUrl: `/alerts/${newAlert._id}`,
              });

              console.log(`📬 Notification d'alerte ${alertData.severity} créée pour le médecin ${doctorId}`);
            }
          } catch (notifError) {
            console.error('⚠️ Erreur création notification d\'alerte:', notifError);
          }
        }

        return newAlert;
      }

      return null;
    } catch (error) {
      console.error('Erreur lors de l’appel à FastAPI:', error.message);
      return null;
    }
  }

    // Récupérer toutes les alertes d'un patient
  async getAlertsByPatient(patientId: string) {
    return this.alertModel
      .find({ patient: new Types.ObjectId(patientId) })
      .sort({ createdAt: -1 })
      .populate('patient', 'firstName lastName')
      .populate('response', 'createdAt')
      .exec();
  }

// alert.service.ts

async findOne(id: string): Promise<Alert> {
  const alert = await this.alertModel
    .findById(id)
    .populate('patient', 'firstName lastName email avatarUrl phoneNumber')  // ← Important : populate le patient
    .exec();

  if (!alert) {
    throw new NotFoundException(`Alert with ID ${id} not found`);
  }

  return alert;
}


  // Récupérer les alertes non lues pour un médecin
  /* async getUnreadAlertsForDoctor(doctorId: string) {
    return this.alertModel
      .find({ 
        doctorId: new Types.ObjectId(doctorId),
        isRead: false 
      })
      .sort({ createdAt: -1 })
      .populate('patient', 'firstName lastName')
      .populate('response')
      .exec();
  } */

  async getUnreadAlertsForDoctor(doctorId: string) {
  return this.alertModel
    .find({ 
      doctorId: doctorId,   // ← doctorId est stocké comme string
      isRead: false 
    })
    .sort({ createdAt: -1 })
    .populate('patient', 'firstName lastName')
    .populate('response')
    .exec();
}

  // Marquer une alerte comme lue
  async markAsRead(alertId: string) {
    return this.alertModel.findByIdAndUpdate(
      alertId,
      { isRead: true, readAt: new Date() },
      { new: true }
    ).exec();
  }

}