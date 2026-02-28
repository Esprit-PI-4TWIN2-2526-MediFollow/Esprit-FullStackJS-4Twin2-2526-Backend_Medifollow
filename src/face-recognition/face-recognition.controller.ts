import { Controller, Post, Delete, Get, Body, Param } from '@nestjs/common';
import { FaceRecognitionService } from './face-recognition.service';

@Controller('api/face-recognition')
export class FaceRecognitionController {
  constructor(private readonly faceRecognitionService: FaceRecognitionService) {}

  @Post('register')
  async registerFace(@Body() body: { userId: string; image: string; descriptor: number[] }) {
    return this.faceRecognitionService.registerFace(body.userId, body.image, body.descriptor);
  }

  @Post('authenticate')
  async authenticate(@Body() body: { email: string; descriptor: number[] }) {
    return this.faceRecognitionService.authenticateWithFace(body.email, body.descriptor);
  }

  @Get('status/:userId')
  async getFaceStatus(@Param('userId') userId: string) {
    const hasRegistered = await this.faceRecognitionService.hasFaceRegistered(userId);
    return { registered: hasRegistered };
  }

  @Delete(':userId')
  async deleteFaceData(@Param('userId') userId: string) {
    return this.faceRecognitionService.deleteFaceData(userId);
  }
}
