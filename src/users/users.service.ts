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
  private readonly exportColumns = [
    'id',
    'firstName',
    'lastName',
    'email',
    'phoneNumber',
    'role',
    'actif',
    'specialization',
    'assignedDepartment',
    'createdAt',
  ] as const;

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
    return this.userModel.find().sort({ createdAt: -1, _id: -1 }).exec();
  }

  async getPatients(): Promise<UserDocument[]> {
    return this.userModel.find({ role: 'patient' }).exec();
  }
  async exportUsers(format: string): Promise<{
    filename: string;
    contentType: string;
    data: Buffer;
  }> {
    const normalizedFormat = format?.trim().toLowerCase();

    if (!['csv', 'pdf'].includes(normalizedFormat)) {
      throw new BadRequestException('Unsupported export format. Use csv or pdf.');
    }

    const users = await this.userModel
      .find()
      .sort({ createdAt: -1, _id: -1 })
      .lean()
      .exec();

    const roleIds = [...new Set(
      users
        .map((user) => user?.role as any)
        .filter((role) => typeof role === 'string' && isValidObjectId(role)),
    )] as string[];

    const roles = roleIds.length > 0
      ? await this.roleModel.find({ _id: { $in: roleIds } }).select('_id name').lean().exec()
      : [];

    const roleMap = new Map(roles.map((role) => [role._id.toString(), role.name]));
    const rows = users.map((user) => this.toExportRow(user, roleMap));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (normalizedFormat === 'csv') {
      return {
        filename: `users-export-${timestamp}.csv`,
        contentType: 'text/csv; charset=utf-8',
        data: Buffer.from(this.buildCsv(rows), 'utf-8'),
      };
    }

    return {
      filename: `users-export-${timestamp}.pdf`,
      contentType: 'application/pdf',
      data: this.buildPdf(rows),
    };
  }

  private toExportRow(
    user: any,
    roleMap: Map<string, string>,
  ): Record<(typeof this.exportColumns)[number], string> {
    const rawRole = user?.role;
    const role =
      rawRole && typeof rawRole === 'object' && 'name' in rawRole
        ? rawRole.name
        : typeof rawRole === 'string' && isValidObjectId(rawRole)
          ? roleMap.get(rawRole) ?? rawRole
          : rawRole || '';

    return {
      id: user?._id?.toString?.() ?? '',
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? '',
      phoneNumber: user?.phoneNumber ?? '',
      role: role?.toString?.() ?? '',
      actif: user?.actif ? 'Active' : 'Inactive',
      specialization: user?.specialization ?? '',
      assignedDepartment: user?.assignedDepartment ?? '',
      createdAt: user?.createdAt ? new Date(user.createdAt).toISOString() : '',
    };
  }

  private buildCsv(rows: Array<Record<(typeof this.exportColumns)[number], string>>): string {
    const header = this.exportColumns.join(',');
    const lines = rows.map((row) =>
      this.exportColumns.map((column) => this.escapeCsvValue(row[column])).join(','),
    );

    return [header, ...lines].join('\n');
  }

  private escapeCsvValue(value: string): string {
    const normalized = (value ?? '').toString().replace(/"/g, '""');
    return `"${normalized}"`;
  }

  private buildPdf(rows: Array<Record<(typeof this.exportColumns)[number], string>>): Buffer {
    const lines = [
      'User Export',
      `Generated at: ${new Date().toISOString()}`,
      '',
      ...rows.flatMap((row, index) => [
        `User ${index + 1}`,
        ...this.exportColumns.map((column) => `${column}: ${row[column]}`),
        '',
      ]),
    ];

    const pageHeight = 792;
    const topMargin = 40;
    const lineHeight = 14;
    const maxLinesPerPage = Math.max(1, Math.floor((pageHeight - topMargin * 2) / lineHeight));
    const pages: string[][] = [];

    for (let i = 0; i < lines.length; i += maxLinesPerPage) {
      pages.push(lines.slice(i, i + maxLinesPerPage));
    }

    return this.createSimplePdf(pages, topMargin, lineHeight, pageHeight);
  }

  private createSimplePdf(pages: string[][], topMargin: number, lineHeight: number, pageHeight: number): Buffer {
    const objects: string[] = [];
    const addObject = (content: string) => {
      objects.push(content);
      return objects.length;
    };

    const fontObjectId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const pageObjectIds: number[] = [];

    for (const pageLines of pages) {
      const contentStream = this.buildPdfContentStream(pageLines, topMargin, lineHeight, pageHeight);
      const contentObjectId = addObject(
        `<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}\nendstream`,
      );
      const pageObjectId = addObject(
        `<< /Type /Page /Parent PAGES_PLACEHOLDER 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
      );
      pageObjectIds.push(pageObjectId);
    }

    const pagesObjectId = addObject(
      `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`,
    );

    for (const pageObjectId of pageObjectIds) {
      objects[pageObjectId - 1] = objects[pageObjectId - 1].replace('PAGES_PLACEHOLDER', String(pagesObjectId));
    }

    const catalogObjectId = addObject(`<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`);

    let pdf = '%PDF-1.4\n';
    const offsets = [0];

    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(pdf, 'utf8'));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i < offsets.length; i += 1) {
      pdf += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, 'utf8');
  }

  private buildPdfContentStream(pageLines: string[], topMargin: number, lineHeight: number, pageHeight: number): string {
    const escapedLines = pageLines.map((line) => this.escapePdfText(line));
    const commands = ['BT', '/F1 11 Tf'];

    escapedLines.forEach((line, index) => {
      const y = pageHeight - topMargin - index * lineHeight;
      commands.push(`1 0 0 1 40 ${y} Tm (${line}) Tj`);
    });

    commands.push('ET');
    return commands.join('\n');
  }

  private escapePdfText(value: string): string {
    return (value ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[^\x20-\x7E]/g, '?');
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

  //get user by role
async findByRole(role: string) {
  const normalizedRole = role?.trim();

  if (!normalizedRole) {
    throw new BadRequestException('role is required');
  }

  return this.userModel.find({
    role: { $regex: new RegExp(`^${normalizedRole}$`, 'i') }
  }).exec();
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

    return this.userModel.findOne({ email: normalizedEmail }).exec();
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

































































































































































