import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';

import { User } from './entities/user.entity';
import { Project } from './entities/project.entity';
import { Contractor } from './entities/contractor.entity';
import { ContractorProject } from './entities/contractor-project.entity';
import { Worker } from './entities/worker.entity';
import { Folder } from './entities/folder.entity';
import { DocumentType } from './entities/document-type.entity';
import { Document } from './entities/document.entity';
import { DocumentVersion } from './entities/document-version.entity';
import { AuditLog } from './entities/audit-log.entity';
import { Alert } from './entities/alert.entity';
import { SanctionRule } from './entities/sanction-rule.entity';
import { Sanction } from './entities/sanction.entity';
import { NotificationLog } from './entities/notification-log.entity';

import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { ProjectsModule } from './projects/projects.module';
import { ContractorsModule } from './contractors/contractors.module';
import { DocumentsModule } from './documents/documents.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SeedModule } from './seed/seed.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SanctionsModule } from './sanctions/sanctions.module';
import { ComplianceEngineModule } from './compliance-engine/compliance-engine.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: join(__dirname, '..', 'etinar-sst.sqlite'),
      entities: [
        User,
        Project,
        Contractor,
        ContractorProject,
        Worker,
        Folder,
        DocumentType,
        Document,
        DocumentVersion,
        AuditLog,
        Alert,
        SanctionRule,
        Sanction,
        NotificationLog,
      ],
      synchronize: true, // solo para entorno de desarrollo/demo
    }),
    AuthModule,
    CommonModule,
    ProjectsModule,
    ContractorsModule,
    DocumentsModule,
    DashboardModule,
    SeedModule,
    NotificationsModule,
    SanctionsModule,
    ComplianceEngineModule,
  ],
})
export class AppModule {}

