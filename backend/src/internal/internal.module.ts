import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { INTERNAL_ENTITIES } from './internal.entities';
import { Project } from '../entities/project.entity';
import { User } from '../entities/user.entity';
import { StoredFile } from '../entities/stored-file.entity';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SharePointModule } from '../sharepoint/sharepoint.module';
import { UserProjectsModule } from '../user-projects/user-projects.module';
import { OneDriveService } from './onedrive.service';
import { DriveSyncService } from './drive-sync.service';
import { InternalEngineService } from './internal-engine.service';
import { InternalReportsService } from './internal-reports.service';
import { InternalSettingsService } from './settings.service';
import { InternalService } from './internal.service';
import { InternalSeedService } from './internal-seed.service';
import { InternalController, InternalCronController } from './internal.controller';
import { AsistenteAccessMiddleware } from './asistente-access.middleware';

/**
 * DOCUMENTACIÓN INTERNA ETINAR: seguimiento de asistentes SST / Ambiente /
 * Médico / Social por obra, integrado con OneDrive/SharePoint, matriz AM 196,
 * alertas, dashboard y reportes automáticos por correo.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([...INTERNAL_ENTITIES, Project, User, StoredFile]),
    CommonModule,
    NotificationsModule,
    SharePointModule,
    UserProjectsModule,
  ],
  providers: [
    OneDriveService,
    DriveSyncService,
    InternalSettingsService,
    InternalEngineService,
    InternalReportsService,
    InternalService,
    InternalSeedService,
  ],
  controllers: [InternalCronController, InternalController],
})
export class InternalModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AsistenteAccessMiddleware).forRoutes('{*splat}');
  }
}
