// src/chat/chat.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';

@Injectable()
export class ChatService {
    constructor(
        @InjectModel(Message.name)
        private messageModel: Model<MessageDocument>,
    ) { }

    buildRoomId(idA: string, idB: string): string {
        const sorted = [idA, idB].sort();
        return `room_${sorted[0]}_${sorted[1]}`;
    }

    async saveMessage(data: {
        senderId: string;
        senderRoleName: string;
        roomId: string;
        content: string;
    }): Promise<Message> {
        const msg = new this.messageModel({
            sender: new Types.ObjectId(data.senderId),
            senderRoleName: data.senderRoleName,
            roomId: data.roomId,
            content: data.content,
        });
        return msg.save();
    }

    async getHistory(roomId: string, limit = 50): Promise<Message[]> {
        return this.messageModel
            .find({ roomId })
            .populate('sender', 'firstName lastName avatarUrl')
            .sort({ createdAt: -1 })
            .limit(limit)
            .exec();
    }

    async markAsRead(roomId: string, userId: string): Promise<void> {
        await this.messageModel.updateMany(
            { roomId, sender: { $ne: new Types.ObjectId(userId) }, read: false },
            { $set: { read: true } },
        );
    }
}