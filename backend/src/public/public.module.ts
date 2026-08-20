import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractorProject } from '../entities/contractor-project.entity';
import { PublicController } from './public.controller';
import { PublicUploadService } from './public-upload.service';
import { UploadLinksModule } from '../upload-links/upload-links.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContractorProject]),
    UploadLinksModule,
    DocumentsModule,
  ],
  controllers: [PublicController],
  providers: [PublicUploadService],
})
export class PublicModule {}
