import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { UserProjectsService } from './user-projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('user-projects')
export class UserProjectsController {
  constructor(private readonly userProjectsService: UserProjectsService) {}

  @Get('user/:userId')
  async getByUserId(@Param('userId') userId: string) {
    return this.userProjectsService.findByUserId(userId);
  }

  @Post()
  async assign(@Body() body: { userId: string; projectId: string }) {
    return this.userProjectsService.assignProjectToUser(body.userId, body.projectId);
  }

  @Delete('user/:userId/project/:projectId')
  async remove(
    @Param('userId') userId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.userProjectsService.removeProjectFromUser(userId, projectId);
  }
}
