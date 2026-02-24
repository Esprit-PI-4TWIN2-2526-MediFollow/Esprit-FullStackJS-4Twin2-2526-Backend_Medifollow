// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthDto } from './auth.dto';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users.service';
import * as bcrypt from 'bcryptjs';
const loginAttempts = new Map<string, { count: number; blockedUntil?: number }>();
const MAX_ATTEMPTS = 5;
const BLOCK_DURATION = 15 * 60 * 1000;
@Injectable()
export class AuthService {

    constructor(
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
            },
        };
    }
    // async signUp(signUpDto: any) {
    //     const existingUser = await this.usersService.findByEmail(signUpDto.email);
    //     if (existingUser) throw new UnauthorizedException('Email already in use');

    //     const hashedPassword = await bcrypt.hash(signUpDto.password, 10);
    //     const user = await this.usersService.create({
    //         ...signUpDto,
    //         password: hashedPassword,
    //     });

    //     const roleValue = typeof user.role === 'object' && user.role !== null && 'name' in user.role ? user.role.name : user.role;
    //     const payload = {
    //         sub: user._id.toString(),
    //         email: user.email,
    //         role: roleValue,
    //     };

    //     return {
    //         accessToken: this.jwtService.sign(payload),
    //         user: {
    //             email: user.email,
    //             role: roleValue,
    //             nom: user.nom,
    //         },
    //     };
    // }
}
