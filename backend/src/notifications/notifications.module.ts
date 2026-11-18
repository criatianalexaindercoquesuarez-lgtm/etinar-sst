import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationLog } from '../entities/notification-log.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { SharePointModule } from '../sharepoint/sharepoint.module';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationLog]), SharePointModule],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
