import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuditService } from './audit.service';
import { Roles, RolesGuard } from '../auth/roles.guard';

@Controller('audit')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @Roles('admin', 'coordinador_sst', 'director')
  findAll() {
    return this.auditService.findAll();
  }
}
