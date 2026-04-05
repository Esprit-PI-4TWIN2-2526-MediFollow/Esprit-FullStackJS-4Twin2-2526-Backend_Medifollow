import { Controller, Post, Body, Get, Param, Patch } from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('communication')
export class CommunicationController {

  constructor(private service: CommunicationService) {}

  @Post()
  send(@Body() dto: SendMessageDto) {
    return this.service.send(dto);
  }

  @Get(':user1/:user2')
  getConversation(@Param('user1') u1: string, @Param('user2') u2: string) {
    return this.service.getConversation(u1, u2);
  }

  @Patch('read/:id')
  markAsRead(@Param('id') id: string) {
    return this.service.markAsRead(id);
  }
}
