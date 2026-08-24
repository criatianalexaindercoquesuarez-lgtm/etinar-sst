import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { TeamUsersService } from './team-users.service';
import { TeamUsersController } from './team-users.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), CommonModule],
  providers: [TeamUsersService],
  controllers: [TeamUsersController],
})
export class TeamUsersModule {}
