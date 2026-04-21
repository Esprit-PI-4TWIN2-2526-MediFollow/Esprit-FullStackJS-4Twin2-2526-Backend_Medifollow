import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false // Accepter les certificats auto-signés en dev
      }
    });
  }

  async sendReactivationEmail(to: string, code: string) {
    const html = `
      <div style="font-family:Arial;padding:20px">
        <h2>Account Expiration Notice</h2>
        <p>Your account will expire in 1 month.</p>
        <p>Use this code to reactivate your account:</p>
        <h3 style="color:blue">${code}</h3>
      </div>
    `;

    await this.transporter.sendMail({
      from: `"Medifollow" <${process.env.MAIL_USER}>`, // joli format
      to,
      subject: 'Account Expiration Reminder',
      html,
    });
  }

  async sendExpiredEmail(to: string) {
    const html = `
      <div style="font-family:Arial;padding:20px">
        <h2>Account Expired</h2>
        <p>Your account has expired.</p>
        <p>Please contact the administration.</p>
      </div>
    `;

    await this.transporter.sendMail({
      from: `"Medifollow" <${process.env.MAIL_USER}>`,
      to,
      subject: 'Account Expired',
      html,
    });
  }

  async sendNewUserCredentialsEmail(
    to: string,
    temporaryPassword: string,
    recipientName?: string,
  ) {
    const loginUrl = process.env.FRONTEND_URL || 'https://medifollow.netlify.app';
    const safeName = recipientName?.trim() || 'User';
    const loginEmail = to.trim();
    const year = new Date().getFullYear();

    const html = `
      <div style="margin:0;padding:24px;background:#f5f8fb;font-family:Arial,sans-serif;color:#1f2937;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background:#0f766e;padding:18px 24px;">
              <h2 style="margin:0;color:#ffffff;font-size:22px;line-height:1.2;">Medifollow</h2>
              <p style="margin:6px 0 0;color:#d1fae5;font-size:13px;">Secure healthcare platform access</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 12px;font-size:15px;">Hello <strong>${safeName}</strong>,</p>
              <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
                Your Medifollow account has been created successfully by the administration.
              </p>
              <p style="margin:0 0 10px;font-size:15px;">Your login email:</p>
              <div style="margin:0 0 18px;padding:12px 14px;background:#f0f9ff;border:1px dashed #0284c7;border-radius:8px;font-size:16px;font-weight:600;color:#0c4a6e;">
                ${loginEmail}
              </div>
              <p style="margin:0 0 10px;font-size:15px;">Your temporary password:</p>
              <div style="margin:0 0 18px;padding:12px 14px;background:#ecfeff;border:1px dashed #0f766e;border-radius:8px;font-size:18px;font-weight:700;letter-spacing:1px;color:#115e59;">
                ${temporaryPassword}
              </div>
              <p style="margin:0 0 14px;font-size:14px;line-height:1.6;">
                For security reasons, you must change this password at your first sign-in. Your account will be activated after that step.
              </p>
              <p style="margin:0 0 20px;">
                <a href="${loginUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">
                  Sign in to Medifollow
                </a>
              </p>
              <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">
                If you did not expect this account creation, contact support immediately at
                <a href="mailto:medifollow@gmail.com" style="color:#0f766e;text-decoration:none;">medifollow@gmail.com</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">© ${year} Medifollow. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </div>
    `;

    await this.transporter.sendMail({
      from: `"Medifollow" <${process.env.MAIL_USER}>`,
      to,
      subject: 'Welcome to Medifollow - Your temporary password',
      html,
    });
  }

  async sendStatusChangeEmail(to: string, status: boolean) {
    const subject = status ? 'Account Activated' : 'Account Deactivated';
    const html = `
      <div style="font-family:Arial;padding:20px">
        <h2>${subject}</h2>
        <p>Hello,</p>
        <p>Your account has been ${status ? 'activated' : 'deactivated'} by the administration.</p>
        <p>Thank you.</p>
      </div>
    `;

    await this.transporter.sendMail({
      from: `"Medifollow" <${process.env.MAIL_USER}>`,
      to,
      subject,
      html,
    });
  }

  async sendEmail(to: string, subject: string, html: string) {
    await this.transporter.sendMail({
      from: `"Medifollow" <${process.env.MAIL_USER}>`,
      to,
      subject,
      html,
    });
  }
}
