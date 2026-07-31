import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '../entities/document.entity';
import { Contractor } from '../entities/contractor.entity';
import { Project } from '../entities/project.entity';
import { Sanction } from '../entities/sanction.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, Contractor, Project, Sanction, AuditLog]),
  ],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
