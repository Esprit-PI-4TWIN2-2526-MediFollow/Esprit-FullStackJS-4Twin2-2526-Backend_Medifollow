

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { HydratedDocument, Model, isValidObjectId } from 'mongoose';
import { User, UserDocument } from './users.schema';
import { Role, RoleDocument } from 'src/role/schemas/role.schema';
import * as bcrypt from 'bcryptjs';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Injectable()
export class UsersService {

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}
  // create user avec image
  async create(user: Partial<User>, avatar?: Express.Multer.File): Promise<UserDocument> {
    const createdAt = new Date();

    if (user.password) {
      const hashed = await bcrypt.hash(user.password as string, 10);
      user = { ...user, password: hashed };
    }

    // Upload avatar si fourni
    if (avatar) {
      const avatarUrl = await this.cloudinaryService.uploadImage(avatar);
      user = { ...user, avatarUrl }; // 👈 stocker l'URL
    }

    const created = new this.userModel({ ...user, createdAt });
    return created.save();
  }
  /* async create(user: Partial<User>): Promise<UserDocument> {
    const createdAt = new Date();
    if (user.password) {
      const saltRounds = 10;
      const hashed = await bcrypt.hash(user.password as string, saltRounds);
      user = { ...user, password: hashed };
    }

    const created = new this.userModel({ ...user, createdAt });
    return created.save();
  } */

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

  // update user
  async update(id: string, user: Partial<User>, avatar?: Express.Multer.File) {
    if (!id || !isValidObjectId(id)) {
      throw new BadRequestException('Invalid MongoDB id');
    }

    if (user.password) {
      const hashed = await bcrypt.hash(user.password as string, 10);
      user = { ...user, password: hashed };
    }

    // Upload nouvel avatar si fourni
    if (avatar) {
      const avatarUrl = await this.cloudinaryService.uploadImage(avatar);
      user = { ...user, avatarUrl }; // mettre à jour l'URL de l'avatar
    }

    const updated = await this.userModel
      .findOneAndUpdate({ _id: id, actif: true } as any, user as any, { new: true })
      .exec();

    if (!updated) throw new NotFoundException('User introuvable');
    return updated;
  }
  /* sync update(id: string, user: Partial<User>) {
    if (!id || !isValidObjectId(id)) {
      throw new BadRequestException('Invalid MongoDB id');
    }

    if (user.password) {
      const saltRounds = 10;
      const hashed = await bcrypt.hash(user.password as string, saltRounds);
      user = { ...user, password: hashed };
    }

    const updated = await this.userModel
      .findOneAndUpdate({ _id: id, actif: true } as any, user as any, { new: true })
      .exec();

    if (!updated) throw new NotFoundException('User introuvable');
    return updated;
  } */

  // delete user
  async delete(id: string) {
    if (!id || !isValidObjectId(id)) {
      throw new BadRequestException('Invalid MongoDB id');
    }

    const existing = await this.userModel.findOne({ _id: id, actif: true }).exec();
    if (!existing) throw new NotFoundException('User introuvable');

    return this.userModel.findByIdAndDelete(id).exec();
  }
  /*  async create(userData: Partial<User>): Promise<UserDocument> {
     const user = new this.userModel(userData);
     return user.save();
 } */

  //     async findByEmail(email: string): Promise<UserDocument | null> {
  //   return this.userModel.findOne({ email }).exec();
  async findByEmail(email: string) {
    try {
      return await this.userModel.findOne({ email }).populate('role').exec();
    } catch (error: any) {
      // Legacy data can contain non-ObjectId role values; avoid signin crash.
      if (error?.name === 'CastError') {
        return this.userModel.findOne({ email }).exec();
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
    return this.userModel.findByIdAndUpdate(
      userId,
      { actif: status },
      { new: true }
    );
  }


}

































































































































































