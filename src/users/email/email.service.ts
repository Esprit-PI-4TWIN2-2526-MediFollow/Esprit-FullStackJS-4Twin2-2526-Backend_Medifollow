import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER, // correction : correspond à ton .env
        pass: process.env.MAIL_PASS, // mot de passe d'application Gmail
      },
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
}
