import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { User, UserDocument } from './users.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  // create user
  async create(user: Partial<User>): Promise<UserDocument> {
    const createdAt = new Date();
    const created = new this.userModel({ ...user, createdAt });
    return created.save();
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

  // update user
  async update(id: string, user: Partial<User>) {
    if (!id || !isValidObjectId(id)) {
      throw new BadRequestException('Invalid MongoDB id');
    }

    const updated = await this.userModel
      .findOneAndUpdate({ _id: id, actif: true } as any, user as any, { new: true })
      .exec();

    if (!updated) throw new NotFoundException('User introuvable');
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
}

































































































































































