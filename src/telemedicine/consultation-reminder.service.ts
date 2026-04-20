import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Consultation, ConsultationDocument } from './schemas/consultation.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ConsultationReminderService {
  private readonly logger = new Logger(ConsultationReminderService.name);

  constructor(
    @InjectModel(Consultation.name)
    private consultationModel: Model<ConsultationDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Run every 10 minutes to check for upcoming consultations
  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkUpcomingConsultations() {
    this.logger.log('🔍 Checking for upcoming consultations...');

    try {
      const now = new Date();
      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const twoHoursAndTenMinutesFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000 + 10 * 60 * 1000);

      // Find consultations scheduled between 2 hours and 2 hours 10 minutes from now
      // This ensures we only send the notification once (within the 10-minute cron window)
      const upcomingConsultations = await this.consultationModel
        .find({
          scheduledAt: {
            $gte: twoHoursFromNow,
            $lt: twoHoursAndTenMinutesFromNow,
          },
          status: { $in: ['scheduled', 'confirmed', 'pending'] },
        })
        .populate('doctor', '_id firstName lastName')
        .populate('patient', '_id firstName lastName email')
        .exec();

      this.logger.log(`📋 Found ${upcomingConsultations.length} upcoming consultation(s)`);

      for (const consultation of upcomingConsultations) {
        try {
          const doctor = consultation.doctor as any;
          const patient = consultation.patient as any;

          // Check if notification already sent (to avoid duplicates)
          const existingNotification = await this.notificationsService.findExisting(
            String(doctor._id),
            'upcoming-consultation',
            String(consultation._id),
          );

          if (existingNotification) {
            this.logger.log(`⏭️  Notification already sent for consultation ${consultation._id}`);
            continue;
          }

          // Create notification for doctor
          await this.notificationsService.create({
            recipientId: String(doctor._id),
            type: 'upcoming-consultation',
            priority: 'high',
            title: 'Consultation Starting Soon',
            message: `Consultation with ${patient.firstName} ${patient.lastName} starts in 2 hours`,
            data: {
              consultationId: consultation._id.toString(),
              scheduledAt: consultation.scheduledAt,
              reason: consultation.reason,
              type: consultation.type,
            },
            patientId: String(patient._id),
            actionUrl: `/telemedicine/consultation/${consultation._id}`,
          });

          this.logger.log(
            `✅ Reminder sent for consultation ${consultation._id} with ${patient.firstName} ${patient.lastName}`,
          );
        } catch (error) {
          this.logger.error(
            `❌ Error sending reminder for consultation ${consultation._id}:`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error('❌ Error checking upcoming consultations:', error);
    }
  }
}
