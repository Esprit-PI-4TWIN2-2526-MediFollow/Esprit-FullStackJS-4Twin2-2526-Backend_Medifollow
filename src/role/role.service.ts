import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { Role, RoleDocument } from './schemas/role.schema';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RoleService {
  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
  ) {}

  async create(dto: CreateRoleDto) {
    try {
      const role = await this.roleModel.create({ name: dto.name.trim() });
      return { message: 'Role created', data: role };
    } catch (e: any) {
      // duplicate key (unique)
      if (e?.code === 11000) {
        throw new BadRequestException('Role name already exists');
      }
      throw e;
    }
  }

  async findAll() {
    const roles = await this.roleModel.find().sort({ createdAt: -1 });
    return { data: roles };
  }

  async findOne(id: string) {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid id');

    const role = await this.roleModel.findById(id);
    if (!role) throw new NotFoundException('Role not found');

    return { data: role };
  }

  async update(id: string, dto: UpdateRoleDto) {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid id');

    try {
      const updated = await this.roleModel.findByIdAndUpdate(
        id,
        { ...(dto.name ? { name: dto.name.trim() } : {}) },
        { new: true },
      );

      if (!updated) throw new NotFoundException('Role not found');
      return { message: 'Role updated', data: updated };
    } catch (e: any) {
      if (e?.code === 11000) {
        throw new BadRequestException('Role name already exists');
      }
      throw e;
    }
  }

  async remove(id: string) {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid id');

    const deleted = await this.roleModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException('Role not found');

    return { message: 'Role deleted' };
  }
}