import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { Prescription, PrescriptionDocument } from './schemas/prescription.schema';
import { Consultation, ConsultationDocument } from './schemas/consultation.schema';
import { User, UserDocument } from '../users/users.schema';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { TelemedicineNotificationService } from './telemedicine-notification.service';
import * as crypto from 'crypto';

@Injectable()
export class PrescriptionService {
  constructor(
    @InjectModel(Prescription.name)
    private prescriptionModel: Model<PrescriptionDocument>,
    @InjectModel(Consultation.name)
    private consultationModel: Model<ConsultationDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private notificationService: TelemedicineNotificationService,
  ) {}

  async create(dto: CreatePrescriptionDto): Promise<Prescription> {
    if (!isValidObjectId(dto.consultationId)) {
      throw new BadRequestException('Invalid consultation ID');
    }

    const consultation = await this.consultationModel
      .findById(dto.consultationId)
      .exec();

    if (!consultation) {
      throw new NotFoundException(`Consultation ${dto.consultationId} not found`);
    }

    // Générer un QR code unique
    const qrCode = this.generateQRCode();

    const prescription = await this.prescriptionModel.create({
      consultation: new Types.ObjectId(dto.consultationId),
      patient: consultation.patient,
      doctor: consultation.doctor,
      medications: dto.medications,
      status: 'draft',
      pharmacyNotes: dto.pharmacyNotes || '',
      qrCode,
      createdAt: new Date(),
    });

    // Ajouter la prescription à la consultation
    await this.consultationModel.findByIdAndUpdate(
      dto.consultationId,
      { $push: { prescriptions: prescription._id } },
    ).exec();

    return prescription;
  }

  async findAll(filters?: {
    patientId?: string;
    doctorId?: string;
    consultationId?: string;
    status?: string;
  }): Promise<Prescription[]> {
    const query: any = {};

    if (filters?.patientId && isValidObjectId(filters.patientId)) {
      query.patient = new Types.ObjectId(filters.patientId);
    }

    if (filters?.doctorId && isValidObjectId(filters.doctorId)) {
      query.doctor = new Types.ObjectId(filters.doctorId);
    }

    if (filters?.consultationId && isValidObjectId(filters.consultationId)) {
      query.consultation = new Types.ObjectId(filters.consultationId);
    }

    if (filters?.status) {
      query.status = filters.status;
    }

    return this.prescriptionModel
      .find(query)
      .populate('patient', 'firstName lastName email phoneNumber')
      .populate('doctor', 'firstName lastName email specialization')
      .populate('consultation', 'scheduledAt type')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<Prescription> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid prescription ID');
    }

    const prescription = await this.prescriptionModel
      .findById(id)
      .populate('patient', 'firstName lastName email phoneNumber dateOfBirth')
      .populate('doctor', 'firstName lastName email specialization')
      .populate('consultation', 'scheduledAt type notes')
      .exec();

    if (!prescription) {
      throw new NotFoundException(`Prescription ${id} not found`);
    }

    return prescription;
  }

  async findByQRCode(qrCode: string): Promise<Prescription> {
    const prescription = await this.prescriptionModel
      .findOne({ qrCode })
      .populate('patient', 'firstName lastName email phoneNumber dateOfBirth')
      .populate('doctor', 'firstName lastName email specialization')
      .exec();

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    return prescription;
  }

  async findByPatient(patientId: string): Promise<Prescription[]> {
    if (!isValidObjectId(patientId)) {
      throw new BadRequestException('Invalid patient ID');
    }

    return this.prescriptionModel
      .find({ patient: new Types.ObjectId(patientId) })
      .populate('doctor', 'firstName lastName specialization')
      .populate('consultation', 'scheduledAt type')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByConsultation(consultationId: string): Promise<Prescription[]> {
    if (!isValidObjectId(consultationId)) {
      throw new BadRequestException('Invalid consultation ID');
    }

    return this.prescriptionModel
      .find({ consultation: new Types.ObjectId(consultationId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async issue(id: string, digitalSignature: string): Promise<Prescription> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid prescription ID');
    }

    const prescription = await this.prescriptionModel.findById(id).exec();

    if (!prescription) {
      throw new NotFoundException(`Prescription ${id} not found`);
    }

    if (prescription.status !== 'draft') {
      throw new BadRequestException('Prescription already issued');
    }

    const now = new Date();
    const validUntil = new Date();
    validUntil.setMonth(validUntil.getMonth() + 3); // Valide 3 mois

    prescription.status = 'issued';
    prescription.issuedAt = now;
    prescription.validUntil = validUntil;
    prescription.digitalSignature = digitalSignature;

    await prescription.save();

    // Envoyer notification au patient avec le PDF
    const populatedPrescription = await this.prescriptionModel
      .findById(id)
      .populate('patient', 'firstName lastName email')
      .populate('doctor', 'firstName lastName')
      .exec();

    if (populatedPrescription) {
      try {
        const patient = populatedPrescription.patient as any;
        const doctor = populatedPrescription.doctor as any;
        await this.notificationService.sendPrescriptionIssued(
          patient.email,
          `${patient.firstName} ${patient.lastName}`,
          `${doctor.firstName} ${doctor.lastName}`,
          populatedPrescription._id.toString(),
          populatedPrescription.qrCode,
        );
      } catch (error) {
        console.error('Error sending prescription notification:', error);
      }
    }

    return prescription;
  }

  async markAsSent(id: string): Promise<Prescription> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid prescription ID');
    }

    const prescription = await this.prescriptionModel
      .findByIdAndUpdate(
        id,
        { status: 'sent' },
        { new: true },
      )
      .exec();

    if (!prescription) {
      throw new NotFoundException(`Prescription ${id} not found`);
    }

    return prescription;
  }

  async markAsDispensed(id: string): Promise<Prescription> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid prescription ID');
    }

    const prescription = await this.prescriptionModel
      .findByIdAndUpdate(
        id,
        { status: 'dispensed' },
        { new: true },
      )
      .exec();

    if (!prescription) {
      throw new NotFoundException(`Prescription ${id} not found`);
    }

    return prescription;
  }

  async delete(id: string): Promise<void> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid prescription ID');
    }

    const result = await this.prescriptionModel.findByIdAndDelete(id).exec();

    if (!result) {
      throw new NotFoundException(`Prescription ${id} not found`);
    }
  }

  private generateQRCode(): string {
    // Générer un code unique de 16 caractères
    return crypto.randomBytes(8).toString('hex').toUpperCase();
  }
}
