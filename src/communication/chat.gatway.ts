import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,

} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { UsersService } from 'src/users/users.service';
import { WsJwtGuard } from './ws-jwt.guard';  // ← manquait
import { UseGuards } from '@nestjs/common';
import { MessageAttachment } from './schemas/message.schema';

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL || 'https://medifollow.netlify.app', credentials: true },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.usersService.findOne(payload.sub);

      if (!user || !user.actif) {
        client.disconnect();
        return;
      }

      (client as any).currentUser = {        
        userId: String(user._id),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        roleName: (user.role as any)?.name ?? 'inconnu',
      };

      console.log(
        `[WS] Connecté : ${user.firstName} ${user.lastName} [${(client as any).currentUser.roleName}]`
      );

    } catch (e: any) {
      console.warn('[WS] Connexion rejetée :', e?.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const u = (client as any).currentUser;
    console.log(`[WS] Déconnecté : ${u?.firstName ?? client.id}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @MessageBody() data: { targetUserId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const me = (client as any).currentUser;
    const roomId = this.chatService.buildRoomId(me.userId, data.targetUserId);

    await client.join(roomId);

    const history = await this.chatService.getHistory(roomId);
    client.emit('history', history.reverse());

    client.to(roomId).emit('user-joined', {
      userId: me.userId,
      name: `${me.firstName} ${me.lastName}`,
      roleName: me.roleName,
    });

    client.emit('room-joined', { roomId });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('send-message')
  async handleMessage(
    @MessageBody()
    data: { roomId: string; content?: string; attachment?: MessageAttachment },
    @ConnectedSocket() client: Socket,
  ) {
    const me = (client as any).currentUser;

    const saved = await this.chatService.saveMessage({
      senderId: me.userId,
      senderRoleName: me.roleName,
      roomId: data.roomId,
      content: data.content,
      attachment: data.attachment,
    });

    this.server.to(data.roomId).emit('receive-message', saved);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { roomId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const me = (client as any).currentUser;
    client.to(data.roomId).emit('typing', {
      userId: me.userId,
      name: `${me.firstName} ${me.lastName}`,
      isTyping: data.isTyping,
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('mark-read')
  async handleMarkRead(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const me = (client as any).currentUser;
    await this.chatService.markAsRead(data.roomId, me.userId);
    client.to(data.roomId).emit('messages-read', { userId: me.userId });
  }
}
