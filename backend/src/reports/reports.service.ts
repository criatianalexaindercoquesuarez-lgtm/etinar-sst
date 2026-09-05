import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import PDFDocument = require('pdfkit');
import * as ExcelJS from 'exceljs';
import { Document } from '../entities/document.entity';
import { Contractor } from '../entities/contractor.entity';
import { Project } from '../entities/project.entity';
import { Sanction } from '../entities/sanction.entity';
import { Alert } from '../entities/alert.entity';
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

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Document) private documentsRepo: Repository<Document>,
    @InjectRepository(Contractor) private contractorsRepo: Repository<Contractor>,
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    @InjectRepository(Sanction) private sanctionsRepo: Repository<Sanction>,
    @InjectRepository(Alert) private alertsRepo: Repository<Alert>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  // ---------- PDF: Reporte Ejecutivo de Cumplimiento (general, no mensual) ----------
  async buildCompliancePdf(): Promise<Buffer> {
    const contractors = await this.contractorsRepo.find();
    const documents = await this.documentsRepo.find({ relations: { contractor: true } });

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

      doc.fontSize(18).fillColor('#16202c').text('Sistema SST ETINAR');
      doc.fontSize(12).fillColor('#3d5266').text('Reporte Ejecutivo de Cumplimiento Documental');
      doc.fontSize(9).fillColor('#7c93a8').text(`Generado: ${new Date().toLocaleString('es-EC')}`);
      doc.moveDown(1.5);

      doc.fontSize(11).fillColor('#16202c').text(`Cumplimiento general: ${overallRate}%`);
      doc.fontSize(10).fillColor('#3d5266').text(`Documentos totales: ${totalDocs}  ·  Aprobados: ${totalApproved}`);
      doc.text(`Contratistas registrados: ${contractors.length}`);
      doc.moveDown(1);

      doc.fontSize(12).fillColor('#16202c').text('Cumplimiento por contratista');
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
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16202C' } };
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

  /**
   * Reúne los datos del informe mensual: cumplimiento general, por
   * proyecto, por contratista, sanciones y alertas del mes en curso
   * (o el mes indicado). Se reutiliza tanto para el PDF como para el Excel.
   */
  private async gatherMonthlyData(year: number, month: number) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);

    const [projects, contractors, documents, sanctionsThisMonth, unresolvedAlerts] =
      await Promise.all([
        this.projectsRepo.find(),
        this.contractorsRepo.find(),
        this.documentsRepo.find({ relations: { contractor: true, project: true } }),
        this.sanctionsRepo.find({
          where: { appliedAt: Between(monthStart, monthEnd) },
          relations: { rule: true, contractor: true },
        }),
        this.alertsRepo.find({ where: { resolved: false }, relations: { document: { contractor: true } } }),
      ]);

    const totalDocs = documents.length;
    const approved = documents.filter((d) => d.status === 'aprobado').length;
    const vencido = documents.filter((d) => d.status === 'vencido').length;
    const porVencer = documents.filter((d) => d.status === 'por_vencer').length;
    const overallRate = totalDocs > 0 ? Math.round((approved / totalDocs) * 100) : 0;

    const byProject = projects.map((p) => {
      const docs = documents.filter((d) => d.project?.id === p.id);
      const total = docs.length;
      const appr = docs.filter((d) => d.status === 'aprobado').length;
      const rate = total > 0 ? Math.round((appr / total) * 100) : 0;
      return { code: p.code, name: p.name, total, approved: appr, rate };
    });

    const byContractor = contractors
      .map((c) => {
        const docs = documents.filter((d) => d.contractor?.id === c.id);
        const total = docs.length;
        const appr = docs.filter((d) => d.status === 'aprobado').length;
        const rate = total > 0 ? Math.round((appr / total) * 100) : 0;
        return { name: c.legalName, status: c.status, total, approved: appr, rate };
      })
      .sort((a, b) => b.rate - a.rate);

    const blockedContractors = contractors.filter((c) => c.status === 'bloqueado').length;
    const suspendedContractors = contractors.filter((c) => c.status === 'suspendido').length;

    return {
      period: `${MESES[month - 1]} ${year}`,
      overallRate,
      totalDocs,
      approved,
      vencido,
      porVencer,
      totalProjects: projects.length,
      totalContractors: contractors.length,
      blockedContractors,
      suspendedContractors,
      byProject,
      byContractor,
      sanctionsThisMonth,
      unresolvedAlerts,
    };
  }

  async buildMonthlyExecutivePdf(year: number, month: number): Promise<Buffer> {
    const data = await this.gatherMonthlyData(year, month);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).fillColor('#16202c').text('Sistema SST ETINAR');
      doc.fontSize(13).fillColor('#3d5266').text(`Informe Mensual de Gestión — ${data.period}`);
      doc.fontSize(9).fillColor('#7c93a8').text(`Generado para Gerencia y Directores de Obra · ${new Date().toLocaleString('es-EC')}`);
      doc.moveDown(1.2);

      // KPIs principales
      doc.fontSize(12).fillColor('#16202c').text('Resumen ejecutivo');
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#3d5266');
      doc.text(`Cumplimiento documental general: ${data.overallRate}%`);
      doc.text(`Proyectos activos: ${data.totalProjects}   ·   Contratistas: ${data.totalContractors}`);
      doc.text(`Empresas bloqueadas: ${data.blockedContractors}   ·   Suspendidas: ${data.suspendedContractors}`);
      doc.text(`Documentos: ${data.totalDocs} totales, ${data.approved} aprobados, ${data.porVencer} por vencer, ${data.vencido} vencidos`);
      doc.text(`Sanciones aplicadas en el mes: ${data.sanctionsThisMonth.length}`);
      doc.text(`Alertas sin resolver: ${data.unresolvedAlerts.length}`);
      doc.moveDown(1);

      // Cumplimiento por proyecto
      doc.fontSize(12).fillColor('#16202c').text('Cumplimiento por proyecto');
      doc.moveDown(0.3);
      doc.fontSize(9).fillColor('#7c93a8');
      doc.text('Proyecto', 50, doc.y, { continued: false });
      doc.text('Docs.', 350, doc.y - 11);
      doc.text('Aprobados', 410, doc.y - 11);
      doc.text('% Cumpl.', 490, doc.y - 11);
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#d7e0e8').stroke();
      doc.moveDown(0.3);
      doc.fontSize(9).fillColor('#16202c');
      for (const p of data.byProject) {
        const y = doc.y;
        doc.text(`${p.code} — ${p.name}`.substring(0, 55), 50, y, { width: 290 });
        doc.text(String(p.total), 350, y);
        doc.text(String(p.approved), 410, y);
        doc.text(`${p.rate}%`, 490, y);
        doc.moveDown(0.6);
      }
      if (data.byProject.length === 0) {
        doc.fontSize(9).fillColor('#7c93a8').text('No hay proyectos registrados.');
      }
      doc.moveDown(0.8);

      // Ranking por contratista
      if (doc.y > 650) doc.addPage();
      doc.fontSize(12).fillColor('#16202c').text('Ranking de cumplimiento por contratista');
      doc.moveDown(0.3);
      doc.fontSize(9).fillColor('#7c93a8');
      doc.text('Contratista', 50, doc.y, { continued: false });
      doc.text('Estado', 300, doc.y - 11);
      doc.text('Docs.', 380, doc.y - 11);
      doc.text('% Cumpl.', 460, doc.y - 11);
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#d7e0e8').stroke();
      doc.moveDown(0.3);
      doc.fontSize(9).fillColor('#16202c');
      for (const c of data.byContractor) {
        if (doc.y > 720) doc.addPage();
        const y = doc.y;
        doc.text(c.name.substring(0, 38), 50, y, { width: 240 });
        doc.text(c.status, 300, y);
        doc.text(String(c.total), 380, y);
        doc.text(`${c.rate}%`, 460, y);
        doc.moveDown(0.6);
      }
      if (data.byContractor.length === 0) {
        doc.fontSize(9).fillColor('#7c93a8').text('No hay contratistas registrados.');
      }

      // Sanciones del mes
      doc.moveDown(0.8);
      if (doc.y > 650) doc.addPage();
      doc.fontSize(12).fillColor('#16202c').text('Sanciones aplicadas en el mes');
      doc.moveDown(0.3);
      doc.fontSize(9).fillColor('#16202c');
      if (data.sanctionsThisMonth.length === 0) {
        doc.fillColor('#7c93a8').text('No se aplicaron sanciones este mes.');
      } else {
        for (const s of data.sanctionsThisMonth) {
          if (doc.y > 720) doc.addPage();
          doc.text(`${new Date(s.appliedAt).toLocaleDateString('es-EC')} — ${s.contractor?.legalName}: ${s.reason}`, { width: 495 });
          doc.moveDown(0.3);
        }
      }

      doc.end();
    });
  }

  async buildMonthlyExecutiveExcel(year: number, month: number): Promise<ExcelJS.Buffer> {
    const data = await this.gatherMonthlyData(year, month);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema SST ETINAR';
    workbook.created = new Date();

    const resumen = workbook.addWorksheet('Resumen');
    resumen.columns = [{ header: 'Indicador', key: 'k', width: 40 }, { header: 'Valor', key: 'v', width: 20 }];
    resumen.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    resumen.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16202C' } };
    resumen.addRows([
      { k: 'Periodo', v: data.period },
      { k: 'Cumplimiento general (%)', v: data.overallRate },
      { k: 'Proyectos', v: data.totalProjects },
      { k: 'Contratistas', v: data.totalContractors },
      { k: 'Empresas bloqueadas', v: data.blockedContractors },
      { k: 'Empresas suspendidas', v: data.suspendedContractors },
      { k: 'Documentos totales', v: data.totalDocs },
      { k: 'Documentos aprobados', v: data.approved },
      { k: 'Documentos por vencer', v: data.porVencer },
      { k: 'Documentos vencidos', v: data.vencido },
      { k: 'Sanciones aplicadas en el mes', v: data.sanctionsThisMonth.length },
      { k: 'Alertas sin resolver', v: data.unresolvedAlerts.length },
    ]);

    const porProyecto = workbook.addWorksheet('Por Proyecto');
    porProyecto.columns = [
      { header: 'Código', key: 'code', width: 12 },
      { header: 'Proyecto', key: 'name', width: 32 },
      { header: 'Documentos', key: 'total', width: 14 },
      { header: 'Aprobados', key: 'approved', width: 14 },
      { header: '% Cumplimiento', key: 'rate', width: 16 },
    ];
    porProyecto.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    porProyecto.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16202C' } };
    for (const p of data.byProject) porProyecto.addRow(p);

    const porContratista = workbook.addWorksheet('Por Contratista');
    porContratista.columns = [
      { header: 'Contratista', key: 'name', width: 32 },
      { header: 'Estado', key: 'status', width: 14 },
      { header: 'Documentos', key: 'total', width: 14 },
      { header: 'Aprobados', key: 'approved', width: 14 },
      { header: '% Cumplimiento', key: 'rate', width: 16 },
    ];
    porContratista.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    porContratista.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16202C' } };
    for (const c of data.byContractor) porContratista.addRow(c);

    const sanciones = workbook.addWorksheet('Sanciones del Mes');
    sanciones.columns = [
      { header: 'Fecha', key: 'date', width: 20 },
      { header: 'Contratista', key: 'contractor', width: 32 },
      { header: 'Motivo', key: 'reason', width: 60 },
    ];
    sanciones.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sanciones.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC2460C' } };
    for (const s of data.sanctionsThisMonth) {
      sanciones.addRow({
        date: new Date(s.appliedAt).toLocaleString('es-EC'),
        contractor: s.contractor?.legalName ?? '',
        reason: s.reason,
      });
    }

    return workbook.xlsx.writeBuffer();
  }
}
