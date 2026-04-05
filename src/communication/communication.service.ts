import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Message } from './schemas/message.schema';
import { Model } from 'mongoose';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageType } from './enums/message.enum';

@Injectable()
export class CommunicationService {

  constructor(
    @InjectModel(Message.name)
    private messageModel: Model<Message>,
  ) {}

  async send(dto: SendMessageDto) {
    const message = await this.messageModel.create(dto);

    // 🔥 LOGIQUE MÉTIER
    if (dto.type === MessageType.ALERT && dto.isUrgent) {
      console.log('🚨 URGENT ALERT');
    }

    if (dto.type === MessageType.REMINDER) {
      console.log('⏰ REMINDER');
    }

    return message;
  }

  async getConversation(user1: string, user2: string) {
    return this.messageModel.find({
      $or: [
        { senderId: user1, receiverId: user2 },
        { senderId: user2, receiverId: user1 },
      ],
    }).sort({ createdAt: 1 });
  }

  async markAsRead(id: string) {
    return this.messageModel.findByIdAndUpdate(
      id,
      { read: true },
      { new: true },
    );
  }
}
