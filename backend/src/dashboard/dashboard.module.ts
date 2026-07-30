import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity';
import { Contractor } from '../entities/contractor.entity';
import { Document } from '../entities/document.entity';
import { Alert } from '../entities/alert.entity';
import { Worker } from '../entities/worker.entity';
import { Sanction } from '../entities/sanction.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Contractor, Document, Alert, Worker, Sanction]),
  ],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
