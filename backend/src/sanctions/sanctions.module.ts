import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SanctionRule } from '../entities/sanction-rule.entity';
import { Sanction } from '../entities/sanction.entity';
import { SanctionsService } from './sanctions.service';
import { SanctionsController } from './sanctions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SanctionRule, Sanction])],
  providers: [SanctionsService],
  controllers: [SanctionsController],
  exports: [SanctionsService, TypeOrmModule],
})
export class SanctionsModule {}
