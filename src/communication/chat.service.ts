// src/chat/chat.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import {
  Message,
  MessageAttachment,
  MessageDocument,
} from './schemas/message.schema';

@Injectable()
export class ChatService {
    constructor(
        @InjectModel(Message.name)
        private messageModel: Model<MessageDocument>,
        private readonly cloudinaryService: CloudinaryService,
    ) { }

    buildRoomId(idA: string, idB: string): string {
        const sorted = [idA, idB].sort();
        return `room_${sorted[0]}_${sorted[1]}`;
    }

    async saveMessage(data: {
        senderId: string;
        senderRoleName: string;
        roomId: string;
        content?: string;
        attachment?: MessageAttachment;
    }): Promise<Message> {
        const content = data.content?.trim() ?? '';

        if (!content && !data.attachment) {
            throw new BadRequestException(
                'Le message doit contenir du texte ou une piece jointe',
            );
        }

        const msg = new this.messageModel({
            sender: new Types.ObjectId(data.senderId),
            senderRoleName: data.senderRoleName,
            roomId: data.roomId,
            content,
            attachment: data.attachment,
            type: this.resolveMessageType(content, data.attachment),
        });
        return msg.save();
    }

    async uploadAttachment(file: Express.Multer.File): Promise<{
        attachment: MessageAttachment;
    }> {
        if (!file?.buffer?.length) {
            throw new BadRequestException('Fichier invalide');
        }

        if (file.mimetype.startsWith('image/')) {
            const uploaded = await this.cloudinaryService.uploadChatImage(file);
            return {
                attachment: {
                    type: 'image',
                    url: uploaded.secure_url,
                    publicId: uploaded.public_id,
                    mimeType: `image/${uploaded.format ?? 'jpeg'}`,
                    originalName: file.originalname,
                    bytes: uploaded.bytes ?? file.size,
                    format: uploaded.format,
                    width: uploaded.width,
                    height: uploaded.height,
                },
            };
        }

        if (this.isAudioMimeType(file.mimetype)) {
            const uploaded = await this.cloudinaryService.uploadChatAudio(file);
            return {
                attachment: {
                    type: 'audio',
                    url: uploaded.secure_url,
                    publicId: uploaded.public_id,
                    mimeType: `audio/${uploaded.format ?? 'mpeg'}`,
                    originalName: file.originalname,
                    bytes: uploaded.bytes ?? file.size,
                    format: uploaded.format,
                    durationSeconds: uploaded.duration,
                },
            };
        }

        throw new BadRequestException('Type de fichier non supporte');
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

    private resolveMessageType(
        content: string,
        attachment?: MessageAttachment,
    ): Message['type'] {
        if (attachment && content) {
            return 'mixed';
        }

        if (attachment) {
            return attachment.type;
        }

        return 'text';
    }

    private isAudioMimeType(mimeType: string): boolean {
        return (
            mimeType.startsWith('audio/') ||
            /^video\/(mp4|webm|ogg)$/i.test(mimeType)
        );
    }
}
