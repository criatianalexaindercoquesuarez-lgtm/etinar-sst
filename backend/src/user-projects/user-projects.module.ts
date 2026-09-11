import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserProject } from '../entities/user-project.entity';
import { User } from '../entities/user.entity';
import { Project } from '../entities/project.entity';
import { UserProjectsService } from './user-projects.service';
import { UserProjectsController } from './user-projects.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserProject, User, Project]), CommonModule],
  providers: [UserProjectsService],
  controllers: [UserProjectsController],
  exports: [UserProjectsService],
})
export class UserProjectsModule {}
