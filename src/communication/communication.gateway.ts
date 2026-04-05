import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';
import { CommunicationService } from './communication.service';
import { SendMessageDto } from './dto/send-message.dto';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class CommunicationGateway
  implements OnGatewayConnection, OnGatewayDisconnect {

  @WebSocketServer()
  server: Server;

  private users = new Map<string, string>(); // userId → socketId

  constructor(private service: CommunicationService) {}

  handleConnection(client: Socket) {
    console.log('Client connected:', client.id);
  }

  handleDisconnect(client: Socket) {
    for (const [userId, socketId] of this.users.entries()) {
      if (socketId === client.id) {
        this.users.delete(userId);
      }
    }
    console.log('Client disconnected:', client.id);
  }

  // 🔐 Register user
  @SubscribeMessage('register')
  register(
    @MessageBody() userId: string,
    @ConnectedSocket() client: Socket,
  ) {
    this.users.set(userId, client.id);
  }

  // 💬 Send message
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() dto: SendMessageDto,
    @ConnectedSocket() client: Socket,
  ) {

    const message = await this.service.send(dto);

    const receiverSocket = this.users.get(dto.receiverId);

    // 🚨 ALERT (nurse)
    if (dto.type === 'alert' && dto.isUrgent) {
      if (receiverSocket) {
        this.server.to(receiverSocket).emit('criticalAlert', message);
      }
      return;
    }

    // ⏰ REMINDER (coordinator)
    if (dto.type === 'reminder') {
      if (receiverSocket) {
        this.server.to(receiverSocket).emit('reminder', message);
      }
      return;
    }

    // 💬 MESSAGE (patient)
    if (receiverSocket) {
      this.server.to(receiverSocket).emit('newMessage', message);
    }

    client.emit('messageSent', message);
  }
}
