import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from 'src/users/auth/jwt.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const isImage = /^image\/(jpeg|jpg|png|webp)$/i.test(file.mimetype);
        const isAudio =
          /^audio\/(mpeg|mp3|wav|webm|ogg|aac|x-m4a)$/i.test(file.mimetype) ||
          /^video\/(mp4|webm|ogg)$/i.test(file.mimetype);

        if (!isImage && !isAudio) {
          return cb(
            new BadRequestException(
              'Seuls les fichiers image et audio sont acceptes pour le chat',
            ),
            false,
          );
        }

        cb(null, true);
      },
    }),
  )
  async uploadAttachment(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const userId = req?.user?.userId ?? req?.user?.sub;

    if (!userId) {
      throw new BadRequestException('Utilisateur non authentifie');
    }

    if (!file) {
      throw new BadRequestException('Fichier manquant');
    }

    return this.chatService.uploadAttachment(file);
  }
}
