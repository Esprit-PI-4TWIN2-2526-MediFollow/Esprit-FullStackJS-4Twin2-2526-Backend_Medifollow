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
          folder: 'avatars', // dossier dans Cloudinary
          transformation: [{ width: 300, height: 300, crop: 'fill' }], // redimensionner
        },
        (error, result) => {
         if (error) return reject(error);
        if (!result) return reject(new Error('Upload failed'));
        resolve(result.secure_url); // URL publique permanente
        },
      );

      // Convertir le buffer en stream
      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

async deleteImage(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }




}
