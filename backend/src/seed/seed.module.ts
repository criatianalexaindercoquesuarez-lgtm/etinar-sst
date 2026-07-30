import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Project } from '../entities/project.entity';
import { Contractor } from '../entities/contractor.entity';
import { ContractorProject } from '../entities/contractor-project.entity';
import { Worker } from '../entities/worker.entity';
import { Folder } from '../entities/folder.entity';
import { DocumentType } from '../entities/document-type.entity';
import { SeedService } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Project,
      Contractor,
      ContractorProject,
      Worker,
      Folder,
      DocumentType,
    ]),
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule implements OnModuleInit {
  constructor(private seedService: SeedService) {}

  async onModuleInit() {
    await this.seedService.run();
  }
}
