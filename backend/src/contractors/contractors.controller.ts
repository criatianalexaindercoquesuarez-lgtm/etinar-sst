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
import { ContractorsService } from './contractors.service';
import { Roles, RolesGuard } from '../auth/roles.guard';

@Controller('contractors')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ContractorsController {
  constructor(private contractorsService: ContractorsService) {}

  @Post()
  @Roles('admin', 'coordinador_sst')
  create(@Body() body: any, @Req() req: any) {
    return this.contractorsService.create(body, req.user);
  }

  @Get()
  @Roles('admin', 'coordinador_sst', 'director')
  findAll() {
    return this.contractorsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    // Un usuario contratista solo puede ver su propio expediente
    if (req.user.role === 'contratista' && req.user.contractorId !== id) {
      return { error: 'No autorizado para ver este contratista' };
    }
    return this.contractorsService.findOne(id);
  }

  @Post(':id/assign-project/:projectId')
  @Roles('admin', 'coordinador_sst')
  assign(
    @Param('id') id: string,
    @Param('projectId') projectId: string,
    @Req() req: any,
  ) {
    return this.contractorsService.assignToProject(id, projectId, req.user);
  }

  @Put(':id')
  @Roles('admin', 'coordinador_sst')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.contractorsService.update(id, body, req.user);
  }
}
