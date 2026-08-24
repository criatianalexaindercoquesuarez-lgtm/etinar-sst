import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TeamUsersService } from './team-users.service';
import { Roles, RolesGuard } from '../auth/roles.guard';

@Controller('team-users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class TeamUsersController {
  constructor(private teamUsersService: TeamUsersService) {}

  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.teamUsersService.create(body, req.user);
  }

  @Get()
  findAll() {
    return this.teamUsersService.findAll();
  }

  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string, @Req() req: any) {
    return this.teamUsersService.resetPassword(id, req.user);
  }

  @Put(':id/active')
  toggleActive(@Param('id') id: string, @Body() body: { active: boolean }, @Req() req: any) {
    return this.teamUsersService.toggleActive(id, body.active, req.user);
  }

  @Put(':id/role')
  updateRole(@Param('id') id: string, @Body() body: { role: string }, @Req() req: any) {
    return this.teamUsersService.updateRole(id, body.role as any, req.user);
  }
}
