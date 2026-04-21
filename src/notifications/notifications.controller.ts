import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../users/auth/jwt.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('doctor/:doctorId/unread')
  async getUnreadNotifications(@Param('doctorId') doctorId: string) {
    return this.notificationsService.getUnreadForDoctor(doctorId);
  }

  @Get('doctor/:doctorId/all')
  async getAllNotifications(
    @Param('doctorId') doctorId: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.notificationsService.getAllForDoctor(doctorId, limitNum);
  }

  @Get('doctor/:doctorId/count')
  async getUnreadCount(@Param('doctorId') doctorId: string) {
    const count = await this.notificationsService.getUnreadCount(doctorId);
    return { count };
  }

  @Get(':id')
  async getNotificationById(@Param('id') id: string) {
    return this.notificationsService.getById(id);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Patch('doctor/:doctorId/mark-all-read')
  async markAllAsRead(@Param('doctorId') doctorId: string) {
    await this.notificationsService.markAllAsRead(doctorId);
    return { message: 'All notifications marked as read' };
  }
}
