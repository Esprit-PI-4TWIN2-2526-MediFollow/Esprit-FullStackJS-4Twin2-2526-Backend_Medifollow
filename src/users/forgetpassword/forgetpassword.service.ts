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
      html: `
        <h3>Reset Your Password</h3>
        <p>Click below to reset:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link expires in 1 hour.</p>
      `,
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

