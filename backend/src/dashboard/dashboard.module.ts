import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity';
import { Contractor } from '../entities/contractor.entity';
import { Document } from '../entities/document.entity';
import { Alert } from '../entities/alert.entity';
import { Worker } from '../entities/worker.entity';
import { Sanction } from '../entities/sanction.entity';
import { ContractorProject } from '../entities/contractor-project.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { UserProjectsModule } from '../user-projects/user-projects.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      Contractor,
      Document,
      Alert,
      Worker,
      Sanction,
      ContractorProject,
    ]),
    UserProjectsModule,
  ],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
