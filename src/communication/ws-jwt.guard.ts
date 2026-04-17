import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();
    const token = client.handshake.auth?.token;
    if (!token) throw new WsException('Token manquant');

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.usersService.findOne(payload.sub);
      if (!user) throw new WsException('Utilisateur introuvable');
      if (!user.actif) throw new WsException('Compte désactivé');

      // Si handleConnection a déjà fait le travail, on réutilise
      // Sinon on le remet (cas rare où le guard est appelé sans connexion préalable)
      if (!(client as any).currentUser) {
        (client as any).currentUser = {
          userId: String(user._id),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          avatarUrl: user.avatarUrl,
          roleName: (user.role as any)?.name ?? 'inconnu',
        };
      }

      return true;
    } catch (e: any) {
      throw new WsException(e?.message ?? 'Token invalide');
    }
  }
}