import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument } from '../users/users.schema';

@Injectable()
export class FaceRecognitionService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async registerFace(userId: string, imageBase64: string, faceDescriptor: number[]) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Store face descriptor and image
    user.faceDescriptor = faceDescriptor;
    user.faceImageUrl = imageBase64;
    await user.save();

    return { success: true, message: 'Face registered successfully' };
  }

  async authenticateWithFace(email: string, faceDescriptor: number[]) {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.faceDescriptor || user.faceDescriptor.length === 0) {
      throw new BadRequestException('No face registered for this user');
    }

    // Calculate euclidean distance between descriptors
    const storedDescriptor = user.faceDescriptor;
    let sum = 0;
    for (let i = 0; i < storedDescriptor.length; i++) {
      const diff = storedDescriptor[i] - faceDescriptor[i];
      sum += diff * diff;
    }
    const distance = Math.sqrt(sum);

    // Threshold for face matching (lower is better, typically < 0.6 is a match)
    const threshold = 0.6;
    
    if (distance > threshold) {
      throw new UnauthorizedException(`Face does not match (distance: ${distance.toFixed(3)})`);
    }

    // Generate JWT token
    const roleValue =
      typeof user.role === 'object' && user.role !== null && 'name' in user.role
        ? user.role.name
        : user.role;

    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: roleValue,
    };

    return {
      success: true,
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user._id.toString(),
        email: user.email,
        role: roleValue,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        phoneNumber: user.phoneNumber,
        actif: user.actif,
      },
      matchDistance: distance,
    };
  }

  async deleteFaceData(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    user.faceDescriptor = [];
    user.faceImageUrl = '';
    await user.save();

    return { success: true, message: 'Face data deleted' };
  }

  async hasFaceRegistered(userId: string): Promise<boolean> {
    const user = await this.userModel.findById(userId);
    return !!(user && user.faceDescriptor && user.faceDescriptor.length > 0);
  }
}
