import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Alert } from './schemas/alert.schema';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AlertsService {
//url de fastApi
 // private readonly fastApiUrl = 'http://localhost:8000/predict-alert';
 private readonly fastApiUrl = 'http://127.0.0.1:8000/predict-alert';

  constructor(
    @InjectModel(Alert.name) private alertModel: Model<Alert>,
    private readonly httpService: HttpService,
  ) {}

  async checkAndCreateAlert(
    patientId: string,
    responseId: string,
    vitals: any,
    doctorId?: string
  ) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(this.fastApiUrl, vitals)
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