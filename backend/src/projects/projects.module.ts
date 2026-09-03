import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity';
import { Folder } from '../entities/folder.entity';
import { DocumentType } from '../entities/document-type.entity';
import { ContractorProject } from '../entities/contractor-project.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Folder, DocumentType, ContractorProject]),
    CommonModule,
  ],
  providers: [ProjectsService],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
