import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '../entities/document.entity';
import { DocumentVersion } from '../entities/document-version.entity';
import { Folder } from '../entities/folder.entity';
import { DocumentType } from '../entities/document-type.entity';
import { Project } from '../entities/project.entity';
import { Contractor } from '../entities/contractor.entity';
import { Alert } from '../entities/alert.entity';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DocumentTypesService } from './document-types.service';
import { CommonModule } from '../common/common.module';
import { SharePointModule } from '../sharepoint/sharepoint.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Document,
      DocumentVersion,
      Folder,
      DocumentType,
      Project,
      Contractor,
      Alert,
    ]),
    CommonModule,
    SharePointModule,
  ],
  providers: [DocumentsService, DocumentTypesService],
  controllers: [DocumentsController],
  exports: [DocumentsService],
})
export class DocumentsModule {}
