import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users.schema';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ForgetpasswordService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {}

  private getTitleByGender(sexe?: string): string {
    const normalized = (sexe || '').toLowerCase().trim();
    if (['male', 'man', 'm', 'homme', 'masculin'].includes(normalized)) {
      return 'Mr.';
    }
    if (['female', 'woman', 'f', 'femme', 'feminin'].includes(normalized)) {
      return 'Mrs.';
    }
    return '';
  }

  private buildDisplayName(user: UserDocument): string {
    return [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  }

  private buildResetPasswordTemplate(user: UserDocument, resetLink: string): string {
    const title = this.getTitleByGender(user.sexe);
    const fullName = this.buildDisplayName(user);
    const greetingName = [title, fullName].filter(Boolean).join(' ').trim() || 'User';

    return `
      <div style="font-family: Arial, sans-serif; background-color: #f5f7f8; padding: 24px;">
        <div style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e6ecef; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #07E38D; padding: 20px 24px;">
            <h2 style="margin: 0; color: #0f172a;">Reset Your Password</h2>
          </div>
          <div style="padding: 24px; color: #1f2937;">
            <p style="margin-top: 0;">Hello ${greetingName},</p>
            <p>You requested a password reset for your Medifollow account.</p>
            <p style="margin: 24px 0;">
              <a
                href="${resetLink}"
                style="display: inline-block; background-color: #07E38D; color: #0f172a; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: 600;"
              >
                Reset Password
              </a>
            </p>
            <p>If the button does not work, use this link:</p>
            <p style="word-break: break-all;">
              <a href="${resetLink}" style="color: #0b8f5a;">${resetLink}</a>
            </p>
            <p>This link expires in 1 hour.</p>
            <p style="margin-bottom: 0;">For more information, contact <a href="mailto:medifollow@gmail.com" style="color: #0b8f5a;">medifollow@gmail.com</a>.</p>
          </div>
        </div>
      </div>
    `;
  }

  async forgotPassword(email: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) throw new NotFoundException('User not found');

    const token = crypto.randomBytes(32).toString('hex');

    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 3600000);
    await user.save();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get('MAIL_USER'),
        pass: this.configService.get('MAIL_PASS'),
      },
    });

    const resetLink = `${this.configService.get(
      'FRONTEND_URL',
    )}/reset-password/${token}`;

    await transporter.sendMail({
      to: user.email,
      subject: 'Reset Password',
      html: this.buildResetPasswordTemplate(user, resetLink),
    });

    return { message: 'Reset email sent successfully' };
  }


async resetPassword(token: string, newPassword: string) {
  try {
    
    const user = await this.userModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      
      throw new BadRequestException('Invalid or expired token');
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    
    
    const result = await this.userModel.updateOne(
      { _id: user._id },
      { 
        $set: { password: hashed },
        $unset: { 
          resetPasswordToken: "", 
          resetPasswordExpires: "" 
        }
      }
    );
    
    const updatedUser = await this.userModel.findById(user._id);
   
    return { message: 'Password reset successful' };
  } catch (error) {
    
    throw error;
  }
}



}

