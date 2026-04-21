import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import * as qrcode from 'qrcode';
import * as speakeasy from 'speakeasy';
import { User, UserDocument } from './users.schema';

@Injectable()
export class TwoFactorService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  private verifyTotp(secretBase32: string, code: string): boolean {
    const token = (code ?? '').trim();
    if (!/^\d{6}$/.test(token)) return false;

    return speakeasy.totp.verify({
      secret: secretBase32,
      encoding: 'base32',
      token,
      window: 1,
    });
  }

  async getStatus(userId: string): Promise<{ twoFactorEnabled: boolean }> {
    if (!userId || !isValidObjectId(userId)) {
      throw new BadRequestException('Invalid MongoDB user id');
    }

    const user = await this.userModel.findById(userId).select('twoFactorEnabled').lean();
    if (!user) throw new NotFoundException('User introuvable');

    return { twoFactorEnabled: Boolean((user as any).twoFactorEnabled) };
  }

  async setup(userId: string): Promise<{
    otpauthUrl: string;
    qrCodeDataUrl: string;
    secretBase32: string;
  }> {
    if (!userId || !isValidObjectId(userId)) {
      throw new BadRequestException('Invalid MongoDB user id');
    }

    const user = await this.userModel.findById(userId).select('email twoFactorEnabled').exec();
    if (!user) throw new NotFoundException('User introuvable');
    if (user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }

    const label = `MediFollow (${user.email})`;
    const secret = speakeasy.generateSecret({
      name: label,
      issuer: 'MediFollow',
      length: 20,
    });

    const otpauthUrl = secret.otpauth_url;
    if (!otpauthUrl || !secret.base32) {
      throw new BadRequestException('Failed to generate TOTP secret');
    }

    user.twoFactorSecret = secret.base32;
    user.twoFactorEnabled = false;
    await user.save();

    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 6,
    });

    return {
      otpauthUrl,
      qrCodeDataUrl,
      secretBase32: secret.base32,
    };
  }

  async enable(userId: string, code: string): Promise<{ twoFactorEnabled: boolean }> {
    if (!userId || !isValidObjectId(userId)) {
      throw new BadRequestException('Invalid MongoDB user id');
    }

    const user = await this.userModel.findById(userId).select('twoFactorEnabled +twoFactorSecret').exec();
    if (!user) throw new NotFoundException('User introuvable');
    if (user.twoFactorEnabled) {
      return { twoFactorEnabled: true };
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException('Two-factor authentication is not set up yet');
    }

    const ok = this.verifyTotp(user.twoFactorSecret, code);
    if (!ok) {
      throw new BadRequestException('Invalid two-factor code');
    }

    user.twoFactorEnabled = true;
    await user.save();

    return { twoFactorEnabled: true };
  }

  async disable(userId: string, code: string): Promise<{ twoFactorEnabled: boolean }> {
    if (!userId || !isValidObjectId(userId)) {
      throw new BadRequestException('Invalid MongoDB user id');
    }

    const user = await this.userModel.findById(userId).select('twoFactorEnabled +twoFactorSecret').exec();
    if (!user) throw new NotFoundException('User introuvable');
    if (!user.twoFactorEnabled) {
      return { twoFactorEnabled: false };
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException('Two-factor secret is missing');
    }

    const ok = this.verifyTotp(user.twoFactorSecret, code);
    if (!ok) {
      throw new BadRequestException('Invalid two-factor code');
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    await user.save();

    return { twoFactorEnabled: false };
  }
}
