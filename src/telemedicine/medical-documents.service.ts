import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { MedicalDocument, MedicalDocumentDocument } from './schemas/medical-document.schema';
import { User, UserDocument } from '../users/users.schema';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { TelemedicineNotificationService } from './telemedicine-notification.service';

@Injectable()
export class MedicalDocumentsService {
  constructor(
    @InjectModel(MedicalDocument.name)
    private documentModel: Model<MedicalDocumentDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private cloudinaryService: CloudinaryService,
    private notificationService: TelemedicineNotificationService,
  ) {}

  async upload(
    file: Express.Multer.File,
    dto: UploadDocumentDto,
    uploadedById: string,
  ): Promise<MedicalDocument> {
    if (!isValidObjectId(dto.patientId) || !isValidObjectId(uploadedById)) {
      throw new BadRequestException('Invalid patient or uploader ID');
    }

    const patient = await this.userModel.findById(dto.patientId).exec();
    if (!patient) {
      throw new NotFoundException(`Patient ${dto.patientId} not found`);
    }

    // Upload vers Cloudinary
    const uploadResult = await this.cloudinaryService.uploadFile(file);

    const metadata: any = {};
    if (dto.examDate) {
      metadata.examDate = new Date(dto.examDate);
    }
    if (dto.laboratory) {
      metadata.laboratory = dto.laboratory;
    }
    if (dto.radiologist) {
      metadata.radiologist = dto.radiologist;
    }

    const sharedWith = dto.sharedWith
      ? dto.sharedWith.filter(isValidObjectId).map(id => new Types.ObjectId(id))
      : [];

    const document = await this.documentModel.create({
      patient: new Types.ObjectId(dto.patientId),
      uploadedBy: new Types.ObjectId(uploadedById),
      consultation: dto.consultationId ? new Types.ObjectId(dto.consultationId) : null,
      type: dto.type,
      title: dto.title,
      description: dto.description || '',
      fileUrl: uploadResult.secure_url,
      fileType: file.mimetype,
      fileSize: file.size,
      metadata,
      sharedWith,
      uploadedAt: new Date(),
      createdAt: new Date(),
    });

    // Send notification to patient
    try {
      await this.notificationService.sendDocumentUploaded(
        patient.email,
        `${patient.firstName} ${patient.lastName}`,
        dto.title,
        dto.type,
        document._id.toString(),
      );
    } catch (error) {
      console.error('Error sending document notification:', error);
    }

    return document;
  }

  async findAll(filters?: {
    patientId?: string;
    consultationId?: string;
    type?: string;
    uploadedById?: string;
  }): Promise<MedicalDocument[]> {
    const query: any = {};

    if (filters?.patientId && isValidObjectId(filters.patientId)) {
      query.patient = new Types.ObjectId(filters.patientId);
    }

    if (filters?.consultationId && isValidObjectId(filters.consultationId)) {
      query.consultation = new Types.ObjectId(filters.consultationId);
    }

    if (filters?.type) {
      query.type = filters.type;
    }

    if (filters?.uploadedById && isValidObjectId(filters.uploadedById)) {
      query.uploadedBy = new Types.ObjectId(filters.uploadedById);
    }

    return this.documentModel
      .find(query)
      .populate('patient', 'firstName lastName email')
      .populate('uploadedBy', 'firstName lastName email')
      .populate('consultation', 'scheduledAt type')
      .sort({ uploadedAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<MedicalDocument> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid document ID');
    }

    const document = await this.documentModel
      .findById(id)
      .populate('patient', 'firstName lastName email')
      .populate('uploadedBy', 'firstName lastName email')
      .populate('consultation', 'scheduledAt type')
      .populate('sharedWith', 'firstName lastName email')
      .exec();

    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    return document;
  }

  async findByPatient(patientId: string): Promise<MedicalDocument[]> {
    if (!isValidObjectId(patientId)) {
      throw new BadRequestException('Invalid patient ID');
    }

    return this.documentModel
      .find({ patient: new Types.ObjectId(patientId) })
      .populate('uploadedBy', 'firstName lastName')
      .populate('consultation', 'scheduledAt type')
      .sort({ uploadedAt: -1 })
      .exec();
  }

  async findByConsultation(consultationId: string): Promise<MedicalDocument[]> {
    if (!isValidObjectId(consultationId)) {
      throw new BadRequestException('Invalid consultation ID');
    }

    return this.documentModel
      .find({ consultation: new Types.ObjectId(consultationId) })
      .populate('uploadedBy', 'firstName lastName')
      .sort({ uploadedAt: -1 })
      .exec();
  }

  async share(id: string, userIds: string[]): Promise<MedicalDocument> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid document ID');
    }

    const validUserIds = userIds
      .filter(isValidObjectId)
      .map(userId => new Types.ObjectId(userId));

    const document = await this.documentModel
      .findByIdAndUpdate(
        id,
        { $addToSet: { sharedWith: { $each: validUserIds } } },
        { new: true },
      )
      .exec();

    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    return document;
  }

  async unshare(id: string, userId: string): Promise<MedicalDocument> {
    if (!isValidObjectId(id) || !isValidObjectId(userId)) {
      throw new BadRequestException('Invalid document or user ID');
    }

    const document = await this.documentModel
      .findByIdAndUpdate(
        id,
        { $pull: { sharedWith: new Types.ObjectId(userId) } },
        { new: true },
      )
      .exec();

    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    return document;
  }

  async delete(id: string): Promise<void> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid document ID');
    }

    const document = await this.documentModel.findById(id).exec();

    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    // Delete from Cloudinary
    try {
      const publicId = this.extractPublicIdFromUrl(document.fileUrl);
      await this.cloudinaryService.deleteFile(publicId);
    } catch (error) {
      console.error('Error deleting file from Cloudinary:', error);
    }

    await this.documentModel.findByIdAndDelete(id).exec();
  }

  private extractPublicIdFromUrl(url: string): string {
    // Extraire le public_id de l'URL Cloudinary
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename.split('.')[0];
  }
}
