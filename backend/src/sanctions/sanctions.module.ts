import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SanctionRule } from '../entities/sanction-rule.entity';
import { Sanction } from '../entities/sanction.entity';
import { ContractorProject } from '../entities/contractor-project.entity';
import { SanctionsService } from './sanctions.service';
import { SanctionsController } from './sanctions.controller';
import { UserProjectsModule } from '../user-projects/user-projects.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SanctionRule, Sanction, ContractorProject]),
    UserProjectsModule,
  ],
  providers: [SanctionsService],
  controllers: [SanctionsController],
  exports: [SanctionsService, TypeOrmModule],
})
export class SanctionsModule {}
