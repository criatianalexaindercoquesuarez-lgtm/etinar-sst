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
  findAll(@Req() req: any) {
    return this.projectsService.findAll(req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.projectsService.findOne(id, req.user);
  }

  @Put(':id')
  @Roles('admin', 'coordinador_sst')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.projectsService.update(id, body, req.user);
  }

  /**
   * Crear una carpeta nueva en un proyecto existente, más allá de las
   * 01-09 estándar. Ej: "10_NUEVO_REQUISITO". Solo Admin.
   */
  @Post(':id/folders')
  @Roles('admin')
  createFolder(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.projectsService.createFolder(id, body, req.user);
  }
}
