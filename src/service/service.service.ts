import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Service, ServiceDocument } from './service.schema';

@Injectable()
export class ServiceService {
  constructor(
    @InjectModel(Service.name)
    private serviceModel: Model<ServiceDocument>,
  ) {}

  async create(dto: CreateServiceDto): Promise<Service> {
    return this.serviceModel.create(dto);
  }

  async findAll(): Promise<Service[]> {
    return this.serviceModel.find({ deletedAt: null });
  }

  async findOne(id: string): Promise<Service> {
    const service = await this.serviceModel.findById(id);
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async update(id: string, dto: UpdateServiceDto): Promise<Service> {
    const updated = await this.serviceModel.findByIdAndUpdate(id, dto, {
      new: true,
    });

    if (!updated) throw new NotFoundException('Service not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const service = await this.serviceModel.findById(id);
    if (!service) throw new NotFoundException('Service not found');

    service.deletedAt = new Date();
    await service.save();
  }

  async activate(id: string) {
    return this.update(id, { statut: 'ACTIF' });
  }

  async deactivate(id: string) {
    return this.update(id, { statut: 'INACTIF' });
  }
}
