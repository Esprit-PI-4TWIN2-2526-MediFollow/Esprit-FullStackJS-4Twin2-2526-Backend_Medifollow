import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  async create(dto: CreateNotificationDto): Promise<Notification> {
    // Set expiration to 30 days from now if not specified
    if (!dto.expiresAt) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      dto.expiresAt = expiresAt;
    }

    const notification = await this.notificationModel.create(dto);
    
    console.log(`📬 Notification created: ${dto.type} for doctor ${dto.recipientId}`);
    
    return notification;
  }

  async getUnreadForDoctor(doctorId: string): Promise<Notification[]> {
    return this.notificationModel
      .find({ 
        recipientId: new Types.ObjectId(doctorId), 
        isRead: false 
      })
      .populate('patientId', 'firstName lastName avatarUrl email phoneNumber')
      .sort({ priority: 1, createdAt: -1 }) // Critical first, then by date
      .limit(50)
      .exec();
  }

  async getAllForDoctor(
    doctorId: string, 
    limit: number = 100
  ): Promise<Notification[]> {
    return this.notificationModel
      .find({ recipientId: new Types.ObjectId(doctorId) })
      .populate('patientId', 'firstName lastName avatarUrl email phoneNumber')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async getById(notificationId: string): Promise<Notification | null> {
    return this.notificationModel
      .findById(notificationId)
      .populate('patientId', 'firstName lastName avatarUrl email phoneNumber assignedDepartment')
      .populate('recipientId', 'firstName lastName email')
      .exec();
  }

  async markAsRead(notificationId: string): Promise<Notification | null> {
    return this.notificationModel
      .findByIdAndUpdate(
        notificationId,
        { 
          isRead: true, 
          readAt: new Date() 
        },
        { new: true }
      )
      .exec();
  }

  async markAllAsRead(doctorId: string): Promise<void> {
    await this.notificationModel
      .updateMany(
        { 
          recipientId: new Types.ObjectId(doctorId), 
          isRead: false 
        },
        { 
          isRead: true, 
          readAt: new Date() 
        }
      )
      .exec();
  }

  async getUnreadCount(doctorId: string): Promise<number> {
    return this.notificationModel
      .countDocuments({ 
        recipientId: new Types.ObjectId(doctorId), 
        isRead: false 
      })
      .exec();
  }

  async deleteOldNotifications(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.notificationModel
      .deleteMany({ 
        createdAt: { $lt: cutoffDate },
        isRead: true 
      })
      .exec();

    return result.deletedCount;
  }

  async findExisting(
    recipientId: string,
    type: string,
    consultationId: string,
  ): Promise<Notification | null> {
    return this.notificationModel.findOne({
      recipientId: new Types.ObjectId(recipientId),
      type,
      'data.consultationId': consultationId,
    }).exec();
  }
}
