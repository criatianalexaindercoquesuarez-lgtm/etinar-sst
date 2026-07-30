import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SanctionsService } from './sanctions.service';
import { Roles, RolesGuard } from '../auth/roles.guard';

@Controller('sanctions')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SanctionsController {
  constructor(private sanctionsService: SanctionsService) {}

  @Post('rules')
  @Roles('admin')
  createRule(@Body() body: any) {
    return this.sanctionsService.createRule(body);
  }

  @Get('rules')
  @Roles('admin', 'coordinador_sst', 'director')
  findAllRules() {
    return this.sanctionsService.findAllRules();
  }

  @Put('rules/:id')
  @Roles('admin')
  updateRule(@Param('id') id: string, @Body() body: any) {
    return this.sanctionsService.updateRule(id, body);
  }

  @Get()
  @Roles('admin', 'coordinador_sst', 'director')
  findAllSanctions() {
    return this.sanctionsService.findAllSanctions();
  }
}
