import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '../entities/document.entity';
import { Contractor } from '../entities/contractor.entity';
import { Worker } from '../entities/worker.entity';
import { Alert } from '../entities/alert.entity';
import { SanctionRule } from '../entities/sanction-rule.entity';
import { Sanction } from '../entities/sanction.entity';
import { User } from '../entities/user.entity';
import { ComplianceEngineService } from './compliance-engine.service';
import { ComplianceEngineController } from './compliance-engine.controller';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Document,
      Contractor,
      Worker,
      Alert,
      SanctionRule,
      Sanction,
      User,
    ]),
    CommonModule,
    NotificationsModule,
  ],
  providers: [ComplianceEngineService],
  controllers: [ComplianceEngineController],
  exports: [ComplianceEngineService],
})
export class ComplianceEngineModule {}
