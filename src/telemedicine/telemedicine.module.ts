import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConsultationController } from './consultation.controller';
import { ConsultationService } from './consultation.service';
import { PrescriptionController } from './prescription.controller';
import { PrescriptionService } from './prescription.service';
import { MedicalDocumentsController } from './medical-documents.controller';
import { MedicalDocumentsService } from './medical-documents.service';
import { TelemedicineNotificationService } from './telemedicine-notification.service';
import { ConsultationReminderService } from './consultation-reminder.service';
import { Consultation, ConsultationSchema } from './schemas/consultation.schema';
import { Prescription, PrescriptionSchema } from './schemas/prescription.schema';
import { MedicalDocument, MedicalDocumentSchema } from './schemas/medical-document.schema';
import { VideoSession, VideoSessionSchema } from './schemas/video-session.schema';
import { User, UserSchema } from '../users/users.schema';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { EmailModule } from '../users/email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Consultation.name, schema: ConsultationSchema },
      { name: Prescription.name, schema: PrescriptionSchema },
      { name: MedicalDocument.name, schema: MedicalDocumentSchema },
      { name: VideoSession.name, schema: VideoSessionSchema },
      { name: User.name, schema: UserSchema },
    ]),
    CloudinaryModule,
    EmailModule,
    NotificationsModule,
  ],
  controllers: [
    ConsultationController,
    PrescriptionController,
    MedicalDocumentsController,
  ],
  providers: [
    ConsultationService,
    PrescriptionService,
    MedicalDocumentsService,
    TelemedicineNotificationService,
    ConsultationReminderService,
  ],
  exports: [
    ConsultationService,
    PrescriptionService,
    MedicalDocumentsService,
    TelemedicineNotificationService,
  ],
})
export class TelemedicineModule {}
