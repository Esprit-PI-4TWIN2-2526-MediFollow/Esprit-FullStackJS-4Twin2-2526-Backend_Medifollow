// src/auth/auth.service.ts
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthDto, FirstLoginPasswordDto } from './auth.dto';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users.service';
import * as bcrypt from 'bcryptjs';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../users.schema';
import { Model, isValidObjectId } from 'mongoose';
const loginAttempts = new Map<string, { count: number; blockedUntil?: number }>();
const MAX_ATTEMPTS = 5;
const BLOCK_DURATION = 15 * 60 * 1000;
@Injectable()
export class AuthService {

    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private usersService: UsersService,
        private jwtService: JwtService,
    ) { }

    private registerFailure(email: string) {
        const now = Date.now();
        const attempt = loginAttempts.get(email) || { count: 0 };

        attempt.count += 1;

        if (attempt.count >= MAX_ATTEMPTS) {
            attempt.blockedUntil = now + BLOCK_DURATION; // 15 min
        }

        loginAttempts.set(email, attempt);
    }
    async signIn(authDto: AuthDto) {
        const email = authDto.email.trim().toLowerCase();

        const now = Date.now();

        const attempt = loginAttempts.get(email);
        //Compte bloqué ?
        if (attempt?.blockedUntil && attempt.blockedUntil > now) {
            const waitSec = Math.ceil((attempt.blockedUntil - now) / 1000);

            throw new UnauthorizedException(
                `Compte temporairement bloqué, réessayez plus tard (${waitSec} secondes)`,
            );
        }

        const user = await this.usersService.findByEmail(email);
        if (!user) {
            this.registerFailure(email);
            const remaining = MAX_ATTEMPTS - (loginAttempts.get(email)?.count || 0);
            throw new UnauthorizedException(`Email ou mot de passe incorrect. ${remaining} tentatives restantes.`);
        }

        const isPasswordValid = await bcrypt.compare(authDto.password, user.password);
        if (!isPasswordValid) {
            this.registerFailure(email);
            const remaining = MAX_ATTEMPTS - (loginAttempts.get(email)?.count || 0);
            throw new UnauthorizedException(`Email ou mot de passe incorrect. ${remaining} tentatives restantes.`);
        }

        loginAttempts.delete(email);

        if (!user.actif) {
            if (user.mustChangePassword) {
                const onboardingToken = this.jwtService.sign(
                    {
                        sub: user._id.toString(),
                        email: user.email,
                        purpose: 'first-login-password-change',
                    },
                    { expiresIn: '15m' },
                );

                return {
                    requiresPasswordChange: true,
                    onboardingToken,
                    message: 'First login detected. Please set a new password to activate your account.',
                };
            }

            throw new UnauthorizedException('Compte inactif. Contactez un administrateur.');
        }

        // rôle depuis la DB (ObjectId ou objet Role)
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
            accessToken: this.jwtService.sign(payload,),
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
    }

    async completeFirstLogin(dto: FirstLoginPasswordDto) {
        const token = dto.onboardingToken?.trim();
        const newPassword = dto.newPassword?.trim();

        if (!token || !newPassword) {
            throw new BadRequestException('onboardingToken and newPassword are required');
        }
        if (newPassword.length < 8) {
            throw new BadRequestException('newPassword must contain at least 8 characters');
        }

        let payload: any;
        try {
            payload = this.jwtService.verify(token);
        } catch {
            throw new UnauthorizedException('Invalid or expired onboarding token');
        }

        if (payload?.purpose !== 'first-login-password-change' || !payload?.sub || !isValidObjectId(payload.sub)) {
            throw new UnauthorizedException('Invalid onboarding token');
        }

        const user = await this.userModel.findById(payload.sub);
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        if (!user.mustChangePassword) {
            throw new BadRequestException('Password change is not required for this account');
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        const now = new Date();

        user.password = hashed;
        user.mustChangePassword = false;
        user.actif = true;
        user.activationExpiresAt = new Date(now.setFullYear(now.getFullYear() + 1));
        await user.save();

        const roleValue =
            typeof user.role === 'object' && user.role !== null && 'name' in user.role
                ? user.role.name
                : user.role;

        const accessToken = this.jwtService.sign({
            sub: user._id.toString(),
            email: user.email,
            role: roleValue,
        });

        return {
            message: 'Password updated and account activated successfully',
            accessToken,
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
    }

}
