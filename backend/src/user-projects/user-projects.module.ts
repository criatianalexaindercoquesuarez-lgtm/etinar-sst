import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserProject } from '../entities/user-project.entity';
import { UserProjectsService } from './user-projects.service';
import { UserProjectsController } from './user-projects.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserProject])],
  controllers: [UserProjectsController],
  providers: [UserProjectsService],
  exports: [UserProjectsService],
})
export class UserProjectsModule {}
