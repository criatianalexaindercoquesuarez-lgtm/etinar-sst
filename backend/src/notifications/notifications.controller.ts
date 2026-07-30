import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';
import { Roles, RolesGuard } from '../auth/roles.guard';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @Roles('admin', 'coordinador_sst', 'director')
  findAll() {
    return this.notificationsService.findAll();
  }
}
