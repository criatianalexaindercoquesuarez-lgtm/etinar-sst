import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentVersion } from '../entities/document-version.entity';
import { StoredFile } from '../entities/stored-file.entity';
import { R2StorageService } from './r2-storage.service';
import { FileStorageService } from './file-storage.service';
import { StorageController } from './storage.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentVersion, StoredFile])],
  providers: [R2StorageService, FileStorageService],
  controllers: [StorageController],
  exports: [R2StorageService, FileStorageService],
})
export class StorageModule {}
