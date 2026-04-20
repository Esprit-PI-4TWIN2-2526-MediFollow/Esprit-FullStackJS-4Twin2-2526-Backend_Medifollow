import { Injectable } from '@nestjs/common';
import { EmailService } from '../users/email/email.service';

@Injectable()
export class TelemedicineNotificationService {
  constructor(private emailService: EmailService) {}

  async sendConsultationScheduled(
    patientEmail: string,
    patientName: string,
    doctorName: string,
    scheduledAt: Date,
    consultationId: string,
  ): Promise<void> {
    const formattedDate = scheduledAt.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const formattedTime = scheduledAt.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const consultationUrl = `${process.env.FRONTEND_URL}/telemedicine/consultation/${consultationId}`;

    const html = `
      <div style="font-family:Arial,sans-serif;padding:20px;background:#f5f8fb;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:#0f766e;padding:20px;">
            <h2 style="margin:0;color:#ffffff;font-size:24px;">Consultation Programmée</h2>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 16px;font-size:16px;">Bonjour <strong>${patientName}</strong>,</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
              Votre consultation avec <strong>Dr. ${doctorName}</strong> a été programmée avec succès.
            </p>
            <div style="background:#f0f9ff;border-left:4px solid #0284c7;padding:16px;margin:20px 0;">
              <p style="margin:0 0 8px;font-size:14px;color:#666;">📅 Date</p>
              <p style="margin:0 0 12px;font-size:16px;font-weight:600;">${formattedDate}</p>
              <p style="margin:0 0 8px;font-size:14px;color:#666;">🕐 Heure</p>
              <p style="margin:0;font-size:16px;font-weight:600;">${formattedTime}</p>
            </div>
            <p style="margin:20px 0;">
              <a href="${consultationUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
                Voir la consultation
              </a>
            </p>
            <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
              Vous recevrez un rappel 30 minutes avant le début de la consultation.
            </p>
          </div>
          <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} Medifollow. Tous droits réservés.</p>
          </div>
        </div>
      </div>
    `;

    await this.emailService.sendEmail(
      patientEmail,
      'Consultation Programmée - Medifollow',
      html,
    );
  }

  async sendConsultationReminder(
    patientEmail: string,
    patientName: string,
    doctorName: string,
    scheduledAt: Date,
    consultationId: string,
  ): Promise<void> {
    const formattedTime = scheduledAt.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const consultationUrl = `${process.env.FRONTEND_URL}/telemedicine/consultation/${consultationId}`;

    const html = `
      <div style="font-family:Arial,sans-serif;padding:20px;background:#f5f8fb;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:#ea580c;padding:20px;">
            <h2 style="margin:0;color:#ffffff;font-size:24px;">⏰ Rappel de Consultation</h2>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 16px;font-size:16px;">Bonjour <strong>${patientName}</strong>,</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
              Votre consultation avec <strong>Dr. ${doctorName}</strong> commence dans 30 minutes à <strong>${formattedTime}</strong>.
            </p>
            <p style="margin:20px 0;">
              <a href="${consultationUrl}" style="display:inline-block;background:#ea580c;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
                Rejoindre la consultation
              </a>
            </p>
          </div>
        </div>
      </div>
    `;

    await this.emailService.sendEmail(
      patientEmail,
      'Rappel: Consultation dans 30 minutes',
      html,
    );
  }

  async sendConsultationCompleted(
    patientEmail: string,
    patientName: string,
    doctorName: string,
    consultationId: string,
    hasPrescription: boolean,
  ): Promise<void> {
    const consultationUrl = `${process.env.FRONTEND_URL}/telemedicine/consultation/${consultationId}`;

    const html = `
      <div style="font-family:Arial,sans-serif;padding:20px;background:#f5f8fb;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:#16a34a;padding:20px;">
            <h2 style="margin:0;color:#ffffff;font-size:24px;">✓ Consultation Terminée</h2>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 16px;font-size:16px;">Bonjour <strong>${patientName}</strong>,</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
              Votre consultation avec <strong>Dr. ${doctorName}</strong> est terminée.
            </p>
            ${
              hasPrescription
                ? `<div style="background:#dcfce7;border-left:4px solid #16a34a;padding:16px;margin:20px 0;">
              <p style="margin:0;font-size:14px;">💊 Une prescription électronique a été créée et est disponible dans votre dossier médical.</p>
            </div>`
                : ''
            }
            <p style="margin:20px 0;">
              <a href="${consultationUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
                Voir le résumé
              </a>
            </p>
          </div>
        </div>
      </div>
    `;

    await this.emailService.sendEmail(
      patientEmail,
      'Résumé de votre consultation',
      html,
    );
  }

  async sendPrescriptionIssued(
    patientEmail: string,
    patientName: string,
    doctorName: string,
    prescriptionId: string,
    qrCode: string,
  ): Promise<void> {
    const prescriptionUrl = `${process.env.FRONTEND_URL}/telemedicine/consultation/${prescriptionId}`;

    const html = `
      <div style="font-family:Arial,sans-serif;padding:20px;background:#f5f8fb;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:#7c3aed;padding:20px;">
            <h2 style="margin:0;color:#ffffff;font-size:24px;">💊 Nouvelle Prescription</h2>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 16px;font-size:16px;">Bonjour <strong>${patientName}</strong>,</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
              <strong>Dr. ${doctorName}</strong> vous a émis une prescription électronique.
            </p>
            <div style="background:#faf5ff;border-left:4px solid #7c3aed;padding:16px;margin:20px 0;">
              <p style="margin:0 0 8px;font-size:14px;color:#666;">Code QR de la prescription</p>
              <p style="margin:0;font-size:20px;font-weight:700;letter-spacing:2px;color:#7c3aed;">${qrCode}</p>
            </div>
            <p style="margin:20px 0;">
              <a href="${prescriptionUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
                Voir la prescription
              </a>
            </p>
            <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
              Présentez ce code QR à votre pharmacien pour obtenir vos médicaments.
            </p>
          </div>
        </div>
      </div>
    `;

    await this.emailService.sendEmail(
      patientEmail,
      'Nouvelle Prescription Électronique',
      html,
    );
  }

  async sendDocumentUploaded(
    patientEmail: string,
    patientName: string,
    documentTitle: string,
    documentType: string,
    documentId: string,
  ): Promise<void> {
    const documentUrl = `${process.env.FRONTEND_URL}/telemedicine/documents`;

    const typeLabels = {
      'lab-result': 'Résultat d\'analyse',
      'imaging': 'Imagerie médicale',
      'report': 'Rapport médical',
      'prescription': 'Prescription',
      'other': 'Document médical',
    };

    const html = `
      <div style="font-family:Arial,sans-serif;padding:20px;background:#f5f8fb;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:#0891b2;padding:20px;">
            <h2 style="margin:0;color:#ffffff;font-size:24px;">📄 Nouveau Document</h2>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 16px;font-size:16px;">Bonjour <strong>${patientName}</strong>,</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
              Un nouveau document a été ajouté à votre dossier médical.
            </p>
            <div style="background:#ecfeff;border-left:4px solid #0891b2;padding:16px;margin:20px 0;">
              <p style="margin:0 0 8px;font-size:14px;color:#666;">Type</p>
              <p style="margin:0 0 12px;font-size:16px;font-weight:600;">${typeLabels[documentType] || documentType}</p>
              <p style="margin:0 0 8px;font-size:14px;color:#666;">Titre</p>
              <p style="margin:0;font-size:16px;font-weight:600;">${documentTitle}</p>
            </div>
            <p style="margin:20px 0;">
              <a href="${documentUrl}" style="display:inline-block;background:#0891b2;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
                Consulter le document
              </a>
            </p>
          </div>
        </div>
      </div>
    `;

    await this.emailService.sendEmail(
      patientEmail,
      'Nouveau Document Médical',
      html,
    );
  }
}
