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
import { UploadLink } from './entities/upload-link.entity';

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
import { ReportsModule } from './reports/reports.module';
import { UploadLinksModule } from './upload-links/upload-links.module';
import { PublicModule } from './public/public.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot(
      process.env.DATABASE_URL
        ? {
            // Producción: PostgreSQL real (ej. Neon), datos persistentes.
            type: 'postgres',
            url: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }, // requerido por Neon y la mayoría de Postgres administrados
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
              UploadLink,
            ],
            synchronize: true, // ver nota sobre migraciones formales en README antes de producción real
          }
        : {
            // Desarrollo local: SQLite en archivo, sin configuración adicional.
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
              UploadLink,
            ],
            synchronize: true,
          },
    ),
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
    ReportsModule,
    UploadLinksModule,
    PublicModule,
  ],
})
export class AppModule {}

