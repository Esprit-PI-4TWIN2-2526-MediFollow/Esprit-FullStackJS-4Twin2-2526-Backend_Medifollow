import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { Authenticator, AuthenticatorDocument } from './schemas/authenticator.schema';
import { User, UserDocument } from '../users/users.schema';

@Injectable()
export class WebauthnService {
  private rpName = 'MediFollow';
  private rpID = 'localhost';
  private origin = `http://localhost:4200`;

  constructor(
    @InjectModel(Authenticator.name)
    private authenticatorModel: Model<AuthenticatorDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {
    console.log('WebAuthn Service initialized with:');
    console.log('- RP Name:', this.rpName);
    console.log('- RP ID:', this.rpID);
    console.log('- Origin:', this.origin);
  }

  async generateRegistrationOptions(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const userAuthenticators = await this.authenticatorModel.find({
      userId: new Types.ObjectId(userId),
    });

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userName: user.email,
      userDisplayName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      attestationType: 'none',
      excludeCredentials: userAuthenticators.map((auth) => ({
        id: auth.credentialID,
        type: 'public-key' as const,
        transports: auth.transports as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: {
        residentKey: 'discouraged',
        userVerification: 'discouraged',
        // Removed authenticatorAttachment to allow any authenticator type
      },
    });

    // Store challenge temporarily (in production, use Redis or session)
    user.resetPasswordToken = options.challenge;
    user.resetPasswordExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await user.save();

    return options;
  }

  async verifyRegistration(
    userId: string,
    response: RegistrationResponseJSON,
  ) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const expectedChallenge = user.resetPasswordToken;
    if (!expectedChallenge) {
      throw new BadRequestException('No challenge found');
    }

    if (user.resetPasswordExpires && user.resetPasswordExpires < new Date()) {
      throw new BadRequestException('Challenge expired');
    }

    try {
      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        requireUserVerification: false,
      });

      const { verified, registrationInfo } = verification;

      if (!verified || !registrationInfo) {
        throw new BadRequestException('Registration verification failed');
      }

      // Extract credential data from registrationInfo
      // registrationInfo structure: { credential: { id, publicKey, counter, ... }, credentialDeviceType, credentialBackedUp, ... }
      const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;
      
      if (!credential || !credential.id || !credential.publicKey) {
        console.error('Missing credential data in registrationInfo:', registrationInfo);
        throw new BadRequestException('Invalid credential data received from authenticator');
      }

      // credential.id and credential.publicKey are Uint8Arrays, convert to base64
      const credentialIDBase64 = Buffer.from(credential.id).toString('base64');
      const credentialPublicKeyBase64 = Buffer.from(credential.publicKey).toString('base64');

      const newAuthenticator = await this.authenticatorModel.create({
        userId: new Types.ObjectId(userId),
        credentialID: credentialIDBase64,
        credentialPublicKey: credentialPublicKeyBase64,
        counter: credential.counter,
        credentialDeviceType: credentialDeviceType || 'singleDevice',
        credentialBackedUp: credentialBackedUp ?? false,
        transports: credential.transports || [],
      });

      // Clear challenge
      user.resetPasswordToken = '';
      user.resetPasswordExpires = new Date(0);
      await user.save();

      return { verified: true, authenticator: newAuthenticator };
    } catch (error) {
      console.error('Verification error:', error);
      throw new BadRequestException('Verification failed: ' + error.message);
    }
  }

  async generateAuthenticationOptions(email: string) {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const userAuthenticators = await this.authenticatorModel.find({
      userId: user._id,
    });

    if (userAuthenticators.length === 0) {
      throw new BadRequestException('No authenticators registered for this user');
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials: userAuthenticators.map((auth) => ({
        id: auth.credentialID,
        type: 'public-key' as const,
        transports: auth.transports as AuthenticatorTransportFuture[],
      })),
      userVerification: 'discouraged', // Changed from 'preferred' to 'discouraged'
    });

    // Store challenge temporarily
    user.resetPasswordToken = options.challenge;
    user.resetPasswordExpires = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    return options;
  }

  async verifyAuthentication(
    email: string,
    response: AuthenticationResponseJSON,
  ) {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const expectedChallenge = user.resetPasswordToken;
    if (!expectedChallenge) {
      throw new BadRequestException('No challenge found');
    }

    if (user.resetPasswordExpires && user.resetPasswordExpires < new Date()) {
      throw new BadRequestException('Challenge expired');
    }

    const authenticator = await this.authenticatorModel.findOne({
      credentialID: Buffer.from(response.id, 'base64url').toString('base64'),
    });

    if (!authenticator) {
      throw new BadRequestException('Authenticator not found');
    }

    try {
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        credential: {
          id: authenticator.credentialID,
          publicKey: Buffer.from(authenticator.credentialPublicKey, 'base64'),
          counter: authenticator.counter,
          transports: authenticator.transports as AuthenticatorTransportFuture[],
        },
        requireUserVerification: false,
      });

      const { verified, authenticationInfo } = verification;

      if (!verified) {
        throw new UnauthorizedException('Authentication verification failed');
      }

      // Update counter
      authenticator.counter = authenticationInfo.newCounter;
      await authenticator.save();

      // Clear challenge
      user.resetPasswordToken = '';
      user.resetPasswordExpires = new Date(0);
      await user.save();

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
        verified: true,
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
      };
    } catch (error) {
      console.error('Authentication error:', error);
      throw new UnauthorizedException('Authentication failed: ' + error.message);
    }
  }

  async getUserAuthenticators(userId: string) {
    return this.authenticatorModel.find({
      userId: new Types.ObjectId(userId),
    }).select('-credentialPublicKey');
  }

  async deleteAuthenticator(userId: string, authenticatorId: string) {
    const result = await this.authenticatorModel.deleteOne({
      _id: new Types.ObjectId(authenticatorId),
      userId: new Types.ObjectId(userId),
    });

    if (result.deletedCount === 0) {
      throw new BadRequestException('Authenticator not found');
    }

    return { success: true };
  }
}
