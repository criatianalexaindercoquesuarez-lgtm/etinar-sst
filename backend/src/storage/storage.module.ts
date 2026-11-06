import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentVersion } from '../entities/document-version.entity';
import { R2StorageService } from './r2-storage.service';
import { StorageController } from './storage.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentVersion])],
  providers: [R2StorageService],
  controllers: [StorageController],
  exports: [R2StorageService],
})
export class StorageModule {}
