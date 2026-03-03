import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { User, UserDocument } from './users.schema';
import { Role, RoleDocument } from 'src/role/schemas/role.schema';
import * as bcrypt from 'bcryptjs';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { EmailService } from './email/email.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomBytes } from 'crypto';

@Injectable()
export class UsersService {

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly emailService: EmailService,

  ) { }

  private generateTemporaryPassword(length = 12): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    const bytes = randomBytes(length);
    let password = '';
    for (let i = 0; i < length; i += 1) {
      password += chars[bytes[i] % chars.length];
    }
    return password;
  }

  // create user avec image
  async create(user: Partial<User>,
    avatar?: Express.Multer.File): Promise<UserDocument> {
    const createdAt = new Date();
    const activationExpiresAt = new Date();
    activationExpiresAt.setFullYear(activationExpiresAt.getFullYear() + 1);
    const temporaryPassword = user.password?.trim() || this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
    const email = user.email?.trim().toLowerCase();

    if (!email) {
      throw new BadRequestException('Email is required');
    }

    // Upload avatar si fourni
    if (avatar) {
      const avatarUrl = await this.cloudinaryService.uploadImage(avatar);
      user = { ...user, avatarUrl }; // 👈 stocker l'URL
    }

    const created = new this.userModel({
      ...user,
      email,
      password: hashedPassword,
      actif: false,
      mustChangePassword: true,
      createdAt,
      activationExpiresAt,
    });

    const savedUser = await created.save();
    const fullName = [savedUser.firstName, savedUser.lastName].filter(Boolean).join(' ').trim();
    await this.emailService.sendNewUserCredentialsEmail(savedUser.email, temporaryPassword, fullName);

    return savedUser;
  }


  // get all users
  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().exec();
  }

  // get user by id
  async findOne(id: string): Promise<UserDocument> {
    if (!id || !isValidObjectId(id)) {
      throw new BadRequestException('Invalid MongoDB id');
    }

    const u = await this.userModel.findOne({ _id: id, actif: true }).exec();
    if (!u) throw new NotFoundException('User introuvable');
    return u;
  }

  async update(id: string, user: Partial<User> = {}, avatar?: Express.Multer.File) {
    if (!id || !isValidObjectId(id)) {
      throw new BadRequestException('Invalid MongoDB id');
    }

    if (!user || typeof user !== 'object') {
      throw new BadRequestException('Invalid request body');
    }

    if (typeof (user as any).actif === 'string') {
      (user as any).actif = (user as any).actif === 'true';
    }

    if (user.password) {
      const hashed = await bcrypt.hash(user.password as string, 10);
      user = { ...user, password: hashed };
    }

    if (avatar) {
      const avatarUrl = await this.cloudinaryService.uploadImage(avatar);
      user = { ...user, avatarUrl };
    }

    const updated = await this.userModel.findByIdAndUpdate(id, user, { new: true });

    if (!updated) {
      throw new NotFoundException('User introuvable');
    }

    if (typeof user.actif === 'boolean') {
      await this.emailService.sendStatusChangeEmail(updated.email, user.actif);
    }

    return updated;
  }

  // delete user
  async delete(id: string) {
    if (!id || !isValidObjectId(id)) {
      throw new BadRequestException('Invalid MongoDB id');
    }

    const existing = await this.userModel.findOne({ _id: id, actif: true }).exec();
    if (!existing) throw new NotFoundException('User introuvable');

    return this.userModel.findByIdAndDelete(id).exec();
  }

  async deleteAll(): Promise<{ deletedCount: number }> {
    const result = await this.userModel.deleteMany({});
    return { deletedCount: result.deletedCount ?? 0 };
  }
  // delete selected inactive users 
  async deleteSelectedInactive(ids: string[]): Promise<{ deletedCount: number }> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('ids must be a non-empty array');
    }

    const validIds = ids.filter((id) => isValidObjectId(id));
    if (validIds.length === 0) {
      throw new BadRequestException('No valid MongoDB ids provided');
    }

    const result = await this.userModel.deleteMany({
      _id: { $in: validIds },
      actif: false,
    });

    return { deletedCount: result.deletedCount ?? 0 };
  }


  // soft delete selected users
  async deleteSelectedSoft(ids: string[]): Promise<{ modifiedCount: number }> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('ids must be a non-empty array');
    }

    const validIds = ids.filter((id) => isValidObjectId(id));
    if (validIds.length === 0) {
      throw new BadRequestException('No valid MongoDB ids provided');
    }

    const result = await this.userModel.updateMany(
      { _id: { $in: validIds }, actif: true },
      { $set: { actif: false } }
    );

    return { modifiedCount: result.modifiedCount ?? 0 };
  }

  async findByEmail(email: string) {
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new BadRequestException('Email is required');
    }

    try {
      return await this.userModel.findOne({ email: normalizedEmail }).populate('role').exec();
    } catch (error: any) {
      // Legacy data can contain non-ObjectId role values; avoid signin crash.
      if (error?.name === 'CastError') {
        return this.userModel.findOne({ email: normalizedEmail }).exec();
      }
      throw error;
    }
  }
  async updateUserRole(userId: string, roleIdOrName: string) {
    if (!userId || !isValidObjectId(userId)) {
      throw new BadRequestException('Invalid MongoDB user id');
    }

    const roleId = await this.resolveRoleId(roleIdOrName);

    return this.userModel.findByIdAndUpdate(
      userId,
      { role: roleId },
      { new: true },
    ).populate('role');
  }

  private async resolveRoleId(roleIdOrName: string): Promise<string> {
    if (!roleIdOrName || !roleIdOrName.trim()) {
      throw new BadRequestException('roleId is required');
    }

    const value = roleIdOrName.trim();
    if (isValidObjectId(value)) {
      const role = await this.roleModel.findById(value).select('_id').lean();
      if (!role) throw new NotFoundException('Role not found');
      return value;
    }

    const roleByName = await this.roleModel
      .findOne({ name: { $regex: `^${value}$`, $options: 'i' } })
      .select('_id')
      .lean();
    if (!roleByName) {
      throw new BadRequestException(
        'Invalid role value. Provide a role id or existing role name.',
      );
    }

    return roleByName._id.toString();
  }


  async setActiveStatus(userId: string, status: boolean) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { actif: status },
      { new: true }
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.emailService.sendStatusChangeEmail(user.email, status);

    return user;
  }


  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkAccountExpiration() {
    const now = new Date();
    const users = await this.userModel.find({ actif: true });

    for (const user of users) {
      if (!user.activationExpiresAt) continue;

      const diffDays = Math.ceil(
        (user.activationExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // 30 jours avant expiration-- générer code
      if (diffDays === 30) {
        await this.generateReactivationCode(user);
      }

      // Compte expiré
      if (diffDays <= 0) {
        user.actif = false;
        await user.save();
        await this.emailService.sendExpiredEmail(user.email);
      }
    }
  }
  async generateReactivationCode(user: UserDocument) {
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 chiffres
    const hash = await bcrypt.hash(code, 10);
    const now = new Date();
    user.reactivationCodeHash = hash;
    user.reactivationCodeExpiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 min
    user.reactivationAttempts = 0;
    user.reactivationBlockedUntil = undefined;
    await user.save();
    await this.emailService.sendReactivationEmail(user.email, code);
  }

  async reactivateAccount(email: string, code: string) {
    const user = await this.userModel.findOne({ email });
    if (!user || !user.reactivationCodeHash) {
      throw new BadRequestException('Invalid request');
    }
    const now = new Date();
    // Vérifier blocage
    if (user.reactivationBlockedUntil && now < user.reactivationBlockedUntil) {
      throw new BadRequestException('Too many attempts. Try again later.');
    }
    //Vérifier expiration
    if (!user.reactivationCodeExpiresAt || now > user.reactivationCodeExpiresAt) {
      throw new BadRequestException('Code expired');
    }
    const isMatch = await bcrypt.compare(code, user.reactivationCodeHash);
    if (!isMatch) {
      user.reactivationAttempts = (user.reactivationAttempts || 0) + 1;
      //Bloquer après 5 tentatives
      if (user.reactivationAttempts >= 5) {
        user.reactivationBlockedUntil = new Date(
          now.getTime() + 30 * 60 * 1000 // 30 min block
        );
      }
      await user.save();
      throw new BadRequestException('Invalid code');
    }
    user.actif = true;
    user.activationExpiresAt = new Date(
      now.setFullYear(now.getFullYear() + 1)
    );
    user.reactivationCodeHash = undefined;
    user.reactivationCodeExpiresAt = undefined;
    user.reactivationAttempts = 0;
    user.reactivationBlockedUntil = undefined;
    await user.save();
    return { message: 'Account reactivated successfully' };
  }


}

































































































































































