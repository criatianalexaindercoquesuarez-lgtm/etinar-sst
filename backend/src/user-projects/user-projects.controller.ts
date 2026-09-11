import { Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserProjectsService } from './user-projects.service';
import { Roles, RolesGuard } from '../auth/roles.guard';

@Controller('team-users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class UserProjectsController {
  constructor(private userProjectsService: UserProjectsService) {}

  @Get(':id/projects')
  list(@Param('id') id: string) {
    return this.userProjectsService.listAssignments(id);
  }

  @Post(':id/projects/:projectId')
  assign(@Param('id') id: string, @Param('projectId') projectId: string, @Req() req: any) {
    return this.userProjectsService.assign(id, projectId, req.user);
  }

  @Delete('projects/:linkId')
  unassign(@Param('linkId') linkId: string, @Req() req: any) {
    return this.userProjectsService.unassign(linkId, req.user);
  }
}
