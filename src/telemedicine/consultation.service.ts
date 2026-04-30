import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { Consultation, ConsultationDocument } from './schemas/consultation.schema';
import { User, UserDocument } from '../users/users.schema';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { UpdateConsultationDto } from './dto/update-consultation.dto';
import { TelemedicineNotificationService } from './telemedicine-notification.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ConsultationService {
  constructor(
    @InjectModel(Consultation.name)
    private consultationModel: Model<ConsultationDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private notificationService: TelemedicineNotificationService,
    private notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateConsultationDto): Promise<Consultation> {
    if (!isValidObjectId(dto.patientId) || !isValidObjectId(dto.doctorId)) {
      throw new BadRequestException('Invalid patient or doctor ID');
    }

    const [patient, doctor] = await Promise.all([
      this.userModel.findById(dto.patientId).exec(),
      this.userModel.findById(dto.doctorId).exec(),
    ]);

    if (!patient) {
      throw new NotFoundException(`Patient ${dto.patientId} not found`);
    }

    if (!doctor) {
      throw new NotFoundException(`Doctor ${dto.doctorId} not found`);
    }

    const consultation = await this.consultationModel.create({
      patient: new Types.ObjectId(dto.patientId),
      doctor: new Types.ObjectId(dto.doctorId),
      type: dto.type || 'scheduled',
      status: 'pending',
      scheduledAt: new Date(dto.scheduledAt),
      reason: dto.reason || '',
      createdAt: new Date(),
    });

    // Send email notification to patient
    try {
      await this.notificationService.sendConsultationScheduled(
        patient.email,
        `${patient.firstName} ${patient.lastName}`,
        `${doctor.firstName} ${doctor.lastName}`,
        new Date(dto.scheduledAt),
        consultation._id.toString(),
      );
    } catch (error) {
      console.error('Error sending consultation notification:', error);
    }

    // Create in-app notification for patient
    try {
      await this.notificationsService.create({
        recipientId: dto.patientId,
        type: 'appointment',
        priority: dto.type === 'urgent' ? 'high' : 'medium',
        title: 'Consultation Scheduled',
        message: `Your consultation with Dr. ${doctor.firstName} ${doctor.lastName} has been scheduled`,
        data: {
          consultationId: consultation._id.toString(),
          scheduledAt: dto.scheduledAt,
          type: dto.type || 'scheduled',
          reason: dto.reason,
          doctorName: `${doctor.firstName} ${doctor.lastName}`,
        },
        patientId: dto.patientId,
        actionUrl: `/telemedicine/consultation/${consultation._id}`,
      });
      console.log(`📬 Consultation notification created for patient ${dto.patientId}`);
    } catch (notifError) {
      console.error('Error creating patient consultation notification:', notifError);
    }

    return consultation;
  }

  async findAll(filters?: {
    status?: string;
    patientId?: string;
    doctorId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Consultation[]> {
    const query: any = {};

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.patientId && isValidObjectId(filters.patientId)) {
      query.patient = new Types.ObjectId(filters.patientId);
    }

    if (filters?.doctorId && isValidObjectId(filters.doctorId)) {
      query.doctor = new Types.ObjectId(filters.doctorId);
    }

    if (filters?.startDate || filters?.endDate) {
      query.scheduledAt = {};
      if (filters.startDate) {
        query.scheduledAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.scheduledAt.$lte = new Date(filters.endDate);
      }
    }

    return this.consultationModel
      .find(query)
      .populate('patient', 'firstName lastName email phoneNumber avatarUrl')
      .populate('doctor', 'firstName lastName email specialization')
      .populate('prescriptions')
      .populate('documents')
      .sort({ scheduledAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<Consultation> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid consultation ID');
    }

    const consultation = await this.consultationModel
      .findById(id)
      .populate('patient', 'firstName lastName email phoneNumber avatarUrl assignedDepartment')
      .populate('doctor', 'firstName lastName email specialization')
      .populate('prescriptions')
      .populate('documents')
      .exec();

    if (!consultation) {
      throw new NotFoundException(`Consultation ${id} not found`);
    }

    return consultation;
  }

  async findByDoctor(doctorId: string): Promise<Consultation[]> {
    if (!isValidObjectId(doctorId)) {
      throw new BadRequestException('Invalid doctor ID');
    }

    return this.consultationModel
      .find({ doctor: new Types.ObjectId(doctorId) })
      .populate('patient', 'firstName lastName email phoneNumber avatarUrl')
      .populate('prescriptions')
      .sort({ scheduledAt: -1 })
      .exec();
  }

  async findByPatient(patientId: string): Promise<Consultation[]> {
    if (!isValidObjectId(patientId)) {
      throw new BadRequestException('Invalid patient ID');
    }

    return this.consultationModel
      .find({ patient: new Types.ObjectId(patientId) })
      .populate('doctor', 'firstName lastName email specialization')
      .populate('prescriptions')
      .populate('documents')
      .sort({ scheduledAt: -1 })
      .exec();
  }

  async update(id: string, dto: UpdateConsultationDto): Promise<Consultation> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid consultation ID');
    }

    const consultation = await this.consultationModel.findById(id).exec();

    if (!consultation) {
      throw new NotFoundException(`Consultation ${id} not found`);
    }

    const updateData: any = {};

    if (dto.status) {
      updateData.status = dto.status;
    }

    if (dto.notes) {
      updateData.notes = dto.notes;
    }

    if (dto.diagnosis) {
      updateData.diagnosis = dto.diagnosis;
    }

    if (dto.recommendations) {
      updateData.recommendations = dto.recommendations;
    }

    if (dto.nextAppointmentSuggested) {
      updateData.nextAppointmentSuggested = new Date(dto.nextAppointmentSuggested);
    }

    if (dto.startedAt) {
      updateData.startedAt = new Date(dto.startedAt);
      if (!consultation.startedAt) {
        updateData.status = 'in-progress';
      }
    }

    if (dto.endedAt) {
      updateData.endedAt = new Date(dto.endedAt);
      updateData.status = 'completed';

      // Calculate duration
      const start = consultation.startedAt || consultation.scheduledAt;
      const end = new Date(dto.endedAt);
      updateData.duration = Math.round((end.getTime() - start.getTime()) / 60000); // in minutes
    }

    const updated = await this.consultationModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('patient', 'firstName lastName email')
      .populate('doctor', 'firstName lastName email')
      .exec();

    if (!updated) {
      throw new NotFoundException(`Consultation ${id} not found after update`);
    }

    // Send summary to patient if consultation completed
    if (dto.endedAt) {
      try {
        const patient = updated.patient as any;
        const doctor = updated.doctor as any;
        const hasPrescription = updated.prescriptions && updated.prescriptions.length > 0;
        await this.notificationService.sendConsultationCompleted(
          patient.email,
          `${patient.firstName} ${patient.lastName}`,
          `${doctor.firstName} ${doctor.lastName}`,
          updated._id.toString(),
          hasPrescription,
        );
      } catch (error) {
        console.error('Error sending completion notification:', error);
      }
    }

    return updated;
  }

  async start(id: string): Promise<Consultation> {
    return this.update(id, {
      status: 'in-progress',
      startedAt: new Date().toISOString(),
    });
  }

  async end(id: string, notes?: string, diagnosis?: string): Promise<Consultation> {
    const updateDto: UpdateConsultationDto = {
      status: 'completed',
      endedAt: new Date().toISOString(),
    };

    if (notes) {
      updateDto.notes = notes;
    }

    if (diagnosis) {
      updateDto.diagnosis = diagnosis;
    }

    return this.update(id, updateDto);
  }

  async cancel(id: string): Promise<Consultation> {
    return this.update(id, { status: 'cancelled' });
  }

  async delete(id: string): Promise<void> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid consultation ID');
    }

    const result = await this.consultationModel.findByIdAndDelete(id).exec();

    if (!result) {
      throw new NotFoundException(`Consultation ${id} not found`);
    }
  }

  async getTodayConsultations(doctorId: string): Promise<Consultation[]> {
    if (!isValidObjectId(doctorId)) {
      throw new BadRequestException('Invalid doctor ID');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.consultationModel
      .find({
        doctor: new Types.ObjectId(doctorId),
        scheduledAt: {
          $gte: today,
          $lt: tomorrow,
        },
      })
      .populate('patient', 'firstName lastName email phoneNumber avatarUrl')
      .sort({ scheduledAt: 1 })
      .exec();
  }

  async getUpcomingConsultations(doctorId: string, days: number = 7): Promise<Consultation[]> {
    if (!isValidObjectId(doctorId)) {
      throw new BadRequestException('Invalid doctor ID');
    }

    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);

    return this.consultationModel
      .find({
        doctor: new Types.ObjectId(doctorId),
        scheduledAt: {
          $gte: now,
          $lte: future,
        },
        status: { $in: ['pending', 'in-progress'] },
      })
      .populate('patient', 'firstName lastName email phoneNumber')
      .sort({ scheduledAt: 1 })
      .exec();
  }
}
