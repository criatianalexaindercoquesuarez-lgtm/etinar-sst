import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadLink } from '../entities/upload-link.entity';
import { Contractor } from '../entities/contractor.entity';
import { UploadLinksService } from './upload-links.service';
import { UploadLinksController } from './upload-links.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [TypeOrmModule.forFeature([UploadLink, Contractor]), CommonModule],
  providers: [UploadLinksService],
  controllers: [UploadLinksController],
  exports: [UploadLinksService],
})
export class UploadLinksModule {}
