import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '../entities/document.entity';
import { Contractor } from '../entities/contractor.entity';
import { Project } from '../entities/project.entity';
import { Sanction } from '../entities/sanction.entity';
import { Alert } from '../entities/alert.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { ContractorProject } from '../entities/contractor-project.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { UserProjectsModule } from '../user-projects/user-projects.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Document,
      Contractor,
      Project,
      Sanction,
      Alert,
      AuditLog,
      ContractorProject,
    ]),
    UserProjectsModule,
  ],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
