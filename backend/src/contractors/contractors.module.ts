import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contractor } from '../entities/contractor.entity';
import { ContractorProject } from '../entities/contractor-project.entity';
import { Project } from '../entities/project.entity';
import { User } from '../entities/user.entity';
import { ContractorsService } from './contractors.service';
import { ContractorsController } from './contractors.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contractor, ContractorProject, Project, User]),
    CommonModule,
  ],
  providers: [ContractorsService],
  controllers: [ContractorsController],
  exports: [ContractorsService],
})
export class ContractorsModule {}
