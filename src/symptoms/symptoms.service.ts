import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Symptom, SymptomDocument } from './symptom.schema';
import { Model } from 'mongoose';
import { CreateSymptomDto } from './dto/create-symptom.dto';

@Injectable()
export class SymptomsService {

  constructor(
    @InjectModel(Symptom.name)
    private symptomModel: Model<SymptomDocument>
  ) {}

  async create(data: CreateSymptomDto) {
    return this.symptomModel.create(data);
  }

  async findAll() {
    return this.symptomModel.find();
  }

  async getLatest() {
    return this.symptomModel.findOne({ isActive: true }).sort({ createdAt: -1 });
  }

}