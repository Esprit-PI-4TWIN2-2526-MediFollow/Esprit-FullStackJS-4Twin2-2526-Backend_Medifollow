// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthDto } from './auth.dto';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users.service';
import * as bcrypt from 'bcryptjs';
import { User } from '../users.schema';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
    ) { }

    async signIn(authDto: AuthDto) {
        const email = authDto.email.trim().toLowerCase();

        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new UnauthorizedException('Email ou mot de passe incorrect');
        }

        const isPasswordValid = await bcrypt.compare(authDto.password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Email ou mot de passe incorrect');
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
            accessToken: this.jwtService.sign(payload),
            user: {
                id: user._id.toString(),
                email: user.email,
                role: roleValue,
            },
        };
    }
    async signUp(signUpDto: any) {
        const existingUser = await this.usersService.findByEmail(signUpDto.email);
        if (existingUser) throw new UnauthorizedException('Email already in use');

        const hashedPassword = await bcrypt.hash(signUpDto.password, 10);
        const user = await this.usersService.create({
            ...signUpDto,
            password: hashedPassword,
        });

        const roleValue = typeof user.role === 'object' && user.role !== null && 'name' in user.role ? user.role.name : user.role;
        const payload = {
            sub: user._id.toString(),
            email: user.email,
            role: roleValue,
        };

        return {
            accessToken: this.jwtService.sign(payload),
            user: {
                email: user.email,
                role: roleValue,
                nom: user.nom,
            },
        };
    }
}
