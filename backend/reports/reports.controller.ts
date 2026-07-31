import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ReportsService } from './reports.service';
import { Roles, RolesGuard } from '../auth/roles.guard';

@Controller('reports')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'coordinador_sst', 'director')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('compliance.pdf')
  async compliancePdf(@Res() res: Response) {
    const buffer = await this.reportsService.buildCompliancePdf();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte-cumplimiento-etinar.pdf"');
    res.send(buffer);
  }

  @Get('documents.xlsx')
  async documentsExcel(@Res() res: Response) {
    const buffer = await this.reportsService.buildDocumentsExcel();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="documentos-etinar.xlsx"');
    res.send(buffer);
  }

  @Get('audit.csv')
  async auditCsv(@Res() res: Response) {
    const csv = await this.reportsService.buildAuditCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="auditoria-etinar.csv"');
    res.send(csv);
  }

  @Get('sanctions.xlsx')
  async sanctionsExcel(@Res() res: Response) {
    const buffer = await this.reportsService.buildSanctionsExcel();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="sanciones-etinar.xlsx"');
    res.send(buffer);
  }
}
