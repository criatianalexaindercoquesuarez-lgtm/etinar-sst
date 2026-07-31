import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument = require('pdfkit');
import * as ExcelJS from 'exceljs';
import { Document } from '../entities/document.entity';
import { Contractor } from '../entities/contractor.entity';
import { Project } from '../entities/project.entity';
import { Sanction } from '../entities/sanction.entity';
import { AuditLog } from '../entities/audit-log.entity';

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  observado: 'Observado',
  rechazado: 'Rechazado',
  aprobado: 'Aprobado',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
  archivado: 'Archivado',
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Document) private documentsRepo: Repository<Document>,
    @InjectRepository(Contractor) private contractorsRepo: Repository<Contractor>,
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    @InjectRepository(Sanction) private sanctionsRepo: Repository<Sanction>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  // ---------- PDF: Reporte Ejecutivo de Cumplimiento ----------
  async buildCompliancePdf(): Promise<Buffer> {
    const contractors = await this.contractorsRepo.find();
    const documents = await this.documentsRepo.find({
      relations: { contractor: true },
    });

    const rows = contractors.map((c) => {
      const docs = documents.filter((d) => d.contractor?.id === c.id);
      const total = docs.length;
      const approved = docs.filter((d) => d.status === 'aprobado').length;
      const rate = total > 0 ? Math.round((approved / total) * 100) : 0;
      return { name: c.legalName, status: c.status, total, approved, rate };
    });

    const totalDocs = documents.length;
    const totalApproved = documents.filter((d) => d.status === 'aprobado').length;
    const overallRate = totalDocs > 0 ? Math.round((totalApproved / totalDocs) * 100) : 0;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc
        .fontSize(18)
        .fillColor('#16202c')
        .text('Sistema SST ETINAR', { continued: false });
      doc
        .fontSize(12)
        .fillColor('#3d5266')
        .text('Reporte Ejecutivo de Cumplimiento Documental');
      doc
        .fontSize(9)
        .fillColor('#7c93a8')
        .text(`Generado: ${new Date().toLocaleString('es-EC')}`);
      doc.moveDown(1.5);

      doc
        .fontSize(11)
        .fillColor('#16202c')
        .text(`Cumplimiento general: ${overallRate}%`, { continued: false });
      doc
        .fontSize(10)
        .fillColor('#3d5266')
        .text(`Documentos totales: ${totalDocs}  ·  Aprobados: ${totalApproved}`);
      doc
        .text(`Contratistas registrados: ${contractors.length}`);
      doc.moveDown(1);

      doc.fontSize(12).fillColor('#16202c').text('Cumplimiento por contratista', { underline: false });
      doc.moveDown(0.5);

      const colX = [50, 280, 370, 440, 500];
      doc.fontSize(9).fillColor('#7c93a8');
      doc.text('Contratista', colX[0], doc.y, { continued: false });
      doc.text('Estado', colX[1], doc.y - 11);
      doc.text('Docs.', colX[2], doc.y - 11);
      doc.text('Aprobados', colX[3], doc.y - 11);
      doc.text('% Cumpl.', colX[4], doc.y - 11);
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#d7e0e8').stroke();
      doc.moveDown(0.3);

      doc.fontSize(9).fillColor('#16202c');
      for (const r of rows) {
        const y = doc.y;
        doc.text(r.name.substring(0, 40), colX[0], y, { width: 220 });
        doc.text(r.status, colX[1], y);
        doc.text(String(r.total), colX[2], y);
        doc.text(String(r.approved), colX[3], y);
        doc.text(`${r.rate}%`, colX[4], y);
        doc.moveDown(0.6);
      }

      if (rows.length === 0) {
        doc.fontSize(9).fillColor('#7c93a8').text('No hay contratistas registrados.');
      }

      doc.end();
    });
  }

  // ---------- Excel: Listado completo de documentos ----------
  async buildDocumentsExcel(): Promise<ExcelJS.Buffer> {
    const documents = await this.documentsRepo.find({
      relations: { contractor: true, project: true, folder: true, documentType: true, versions: true },
      order: { createdAt: 'DESC' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema SST ETINAR';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Documentos');
    sheet.columns = [
      { header: 'Proyecto', key: 'project', width: 22 },
      { header: 'Contratista', key: 'contractor', width: 32 },
      { header: 'Carpeta', key: 'folder', width: 26 },
      { header: 'Tipo documental', key: 'type', width: 32 },
      { header: 'Estado', key: 'status', width: 14 },
      { header: 'Versiones', key: 'versions', width: 10 },
      { header: 'Fecha de vencimiento', key: 'dueDate', width: 18 },
      { header: 'Fecha de aprobación', key: 'approvedAt', width: 20 },
      { header: 'Creado', key: 'createdAt', width: 20 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF16202C' },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const d of documents) {
      sheet.addRow({
        project: `${d.project?.code ?? ''} - ${d.project?.name ?? ''}`,
        contractor: d.contractor?.legalName ?? '',
        folder: `${d.folder?.code ?? ''} ${d.folder?.name ?? ''}`,
        type: d.documentType?.name ?? '',
        status: STATUS_LABELS[d.status] ?? d.status,
        versions: d.versions?.length ?? 0,
        dueDate: d.dueDate ?? '',
        approvedAt: d.approvedAt ? new Date(d.approvedAt).toLocaleString('es-EC') : '',
        createdAt: new Date(d.createdAt).toLocaleString('es-EC'),
      });
    }

    sheet.autoFilter = { from: 'A1', to: 'I1' };
    return workbook.xlsx.writeBuffer();
  }

  // ---------- CSV: Bitácora de auditoría ----------
  async buildAuditCsv(): Promise<string> {
    const logs = await this.auditRepo.find({ order: { createdAt: 'DESC' }, take: 5000 });
    const header = ['Fecha', 'Usuario', 'Accion', 'Tipo', 'ID', 'Detalle'];
    const csvEscape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [header.join(',')];
    for (const l of logs) {
      lines.push(
        [
          new Date(l.createdAt).toISOString(),
          csvEscape(l.userEmail),
          csvEscape(l.action),
          csvEscape(l.entityType),
          csvEscape(l.entityId),
          csvEscape(l.details),
        ].join(','),
      );
    }
    return lines.join('\n');
  }

  // ---------- Excel: Sanciones y multas aplicadas ----------
  async buildSanctionsExcel(): Promise<ExcelJS.Buffer> {
    const sanctions = await this.sanctionsRepo.find({
      relations: { rule: true, contractor: true, worker: true, document: { documentType: true } },
      order: { appliedAt: 'DESC' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sanciones');
    sheet.columns = [
      { header: 'Fecha', key: 'date', width: 20 },
      { header: 'Contratista', key: 'contractor', width: 32 },
      { header: 'Trabajador', key: 'worker', width: 24 },
      { header: 'Regla', key: 'rule', width: 24 },
      { header: 'Acción aplicada', key: 'action', width: 22 },
      { header: 'Motivo', key: 'reason', width: 50 },
      { header: 'Resuelta', key: 'resolved', width: 12 },
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC2460C' } };

    for (const s of sanctions) {
      sheet.addRow({
        date: new Date(s.appliedAt).toLocaleString('es-EC'),
        contractor: s.contractor?.legalName ?? '',
        worker: s.worker?.fullName ?? '—',
        rule: s.rule?.trigger ?? '',
        action: s.rule?.action ?? '',
        reason: s.reason,
        resolved: s.resolved ? 'Sí' : 'No',
      });
    }

    return workbook.xlsx.writeBuffer();
  }
}
