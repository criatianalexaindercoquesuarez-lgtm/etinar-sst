import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProjectsService } from './projects.service';
import { Roles, RolesGuard } from '../auth/roles.guard';

@Controller('projects')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Post()
  @Roles('admin', 'coordinador_sst')
  create(@Body() body: any, @Req() req: any) {
    return this.projectsService.create(body, req.user);
  }

  @Get()
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Put(':id')
  @Roles('admin', 'coordinador_sst')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.projectsService.update(id, body, req.user);
  }
}
