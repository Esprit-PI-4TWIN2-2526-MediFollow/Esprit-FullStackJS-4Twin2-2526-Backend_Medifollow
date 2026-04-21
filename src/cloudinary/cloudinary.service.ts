import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadImage(file: Express.Multer.File): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'avatars',
          transformation: [{ width: 300, height: 300, crop: 'fill' }],
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error('Upload failed'));
          resolve(result.secure_url);
        },
      );

      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

  async uploadFile(file: Express.Multer.File): Promise<any> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'medical-documents',
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error('Upload failed'));
          resolve(result);
        },
      );

      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

  async uploadChatImage(file: Express.Multer.File): Promise<any> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'chat/images',
          resource_type: 'image',
          transformation: [
            {
              width: 1600,
              height: 1600,
              crop: 'limit',
              quality: 'auto:eco',
              fetch_format: 'auto',
            },
          ],
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error('Image upload failed'));
          resolve(result);
        },
      );

      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

  async uploadChatAudio(file: Express.Multer.File): Promise<any> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'chat/audio',
          resource_type: 'video',
          format: 'mp3',
          transformation: [
            {
              audio_codec: 'mp3',
              bit_rate: '96k',
            },
          ],
        } as any,
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error('Audio upload failed'));
          resolve(result);
        },
      );

      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  async deleteFile(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
  }
}
