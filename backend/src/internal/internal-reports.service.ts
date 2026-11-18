import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, LessThanOrEqual, Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import PDFDocument = require('pdfkit');
import {
  ActivityInstance,
  Am196Item,
  DISCIPLINE_LABELS,
  DriveItem,
  InternalAlert,
  InternalReport,
  InternalStaff,
  StaffAssignment,
  TrackingHistory,
} from './internal.entities';
import { Project } from '../entities/project.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { InternalSettingsService } from './settings.service';
import { InternalEngineService, escapeHtml } from './internal-engine.service';
import { addDays, ecToday, humanDate, isoWeekday, MESES, Period, periodFor, previousMonth, previousWeek, semaphore } from './periods';

export type ReportType = 'semanal' | 'mensual';

interface Stats {
  total: number;
  ejecutadas: number;
  pendientes: number;
  incompletas: number;
  vencidas: number;
  tarde: number;
  noAplica: number;
  pct: number | null;
}

function computeStats(list: ActivityInstance[], today: string): Stats {
  const s: Stats = { total: list.length, ejecutadas: 0, pendientes: 0, incompletas: 0, vencidas: 0, tarde: 0, noAplica: 0, pct: null };
  let evaluable = 0;
  for (const i of list) {
    if (i.status === 'ejecutada') {
      s.ejecutadas++;
      evaluable++;
      if (i.late) s.tarde++;
    } else if (i.status === 'vencida') {
      s.vencidas++;
      evaluable++;
    } else if (i.status === 'incompleta') {
      s.incompletas++;
      if (today > i.dueDate) evaluable++;
    } else if (i.status === 'pendiente') s.pendientes++;
    else if (i.status === 'no_aplica') s.noAplica++;
  }
  // % = ejecutadas / actividades ya exigibles (vencidas + incompletas fuera de plazo + ejecutadas)
  s.pct = evaluable ? Math.round((s.ejecutadas / evaluable) * 1000) / 10 : null;
  return s;
}

function am196Stats(items: Am196Item[]) {
  const c = { total: 0, cumple: 0, por_actualizar: 0, vencido: 0, faltante: 0, observado: 0, no_aplica: 0, pct: null as number | null };
  for (const i of items) {
    c[i.status] = (c[i.status] || 0) + 1;
    if (i.status !== 'no_aplica') c.total++;
  }
  c.pct = c.total ? Math.round(((c.cumple + c.por_actualizar) / c.total) * 1000) / 10 : null;
  return c;
}

@Injectable()
export class InternalReportsService {
  private readonly logger = new Logger(InternalReportsService.name);

  constructor(
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    @InjectRepository(ActivityInstance) private instRepo: Repository<ActivityInstance>,
    @InjectRepository(Am196Item) private amRepo: Repository<Am196Item>,
    @InjectRepository(InternalStaff) private staffRepo: Repository<InternalStaff>,
    @InjectRepository(StaffAssignment) private assignRepo: Repository<StaffAssignment>,
    @InjectRepository(InternalAlert) private alertsRepo: Repository<InternalAlert>,
    @InjectRepository(DriveItem) private itemsRepo: Repository<DriveItem>,
    @InjectRepository(TrackingHistory) private historyRepo: Repository<TrackingHistory>,
    @InjectRepository(InternalReport) private reportsRepo: Repository<InternalReport>,
    private notifications: NotificationsService,
    private settings: InternalSettingsService,
    private engine: InternalEngineService,
  ) {
    engine.reportsRunner = (today) => this.runScheduled(today);
  }

  periodOf(type: ReportType, key?: string): Period {
    if (!key) return type === 'semanal' ? previousWeek() : previousMonth();
    if (type === 'mensual') return periodFor('mensual', `${key}-01`);
    // clave semanal: cualquier fecha YYYY-MM-DD dentro de la semana
    return periodFor('semanal', key);
  }

  /** Envía los reportes que correspondan hoy y aún no se hayan enviado. */
  async runScheduled(today = ecToday()) {
    const cfg = await this.settings.all();
    const out: any = {};
    const projects = await this.engine.internalProjectIds();
    if (!projects.length) return { skipped: 'sin obras con seguimiento interno' };

    if (cfg.weeklyEnabled === 'true' && isoWeekday(today) >= Number(cfg.weeklyDay || 2)) {
      const p = previousWeek(today);
      const done = await this.reportsRepo.findOne({ where: { type: 'semanal', periodKey: p.key, trigger: 'auto', status: In(['enviado', 'simulado']) } });
      if (!done) out.semanal = await this.send('semanal', p, 'auto', 'sistema');
    }
    const day = Number(today.slice(8, 10));
    if (cfg.monthlyEnabled === 'true' && day >= Number(cfg.monthlyDay || 6)) {
      const p = previousMonth(today);
      const done = await this.reportsRepo.findOne({ where: { type: 'mensual', periodKey: p.key, trigger: 'auto', status: In(['enviado', 'simulado']) } });
      if (!done) out.mensual = await this.send('mensual', p, 'auto', 'sistema');
    }
    return out;
  }

  async send(type: ReportType, period: Period, trigger: 'auto' | 'manual', actor: string, to?: string[]) {
    const recipients = to?.length ? to : await this.settings.recipients();
    const data = await this.buildData(type, period);
    const html = this.renderHtml(data);
    const text = this.renderText(data);
    const attachments: { filename: string; content: Buffer; contentType: string }[] = [
      {
        filename: `reporte-${type}-documentacion-interna-${period.key}.xlsx`,
        content: await this.buildExcel(data),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ];
    if (type === 'mensual') {
      attachments.push({
        filename: `reporte-mensual-documentacion-interna-${period.key}.pdf`,
        content: await this.buildPdf(data),
        contentType: 'application/pdf',
      });
    }
    let status = 'error';
    if (recipients.length) {
      const log = await this.notifications.send({
        to: recipients.join(','),
        subject: data.title,
        body: text,
        html,
        attachments,
      });
      status = log.status;
    }
    const saved = await this.reportsRepo.save(
      this.reportsRepo.create({
        type,
        periodKey: period.key,
        periodStart: period.start,
        periodEnd: period.end,
        recipients: recipients.join(', '),
        status: recipients.length ? status : 'error',
        trigger,
        triggeredBy: actor,
        summary: { totals: data.totals, am196: data.am196Totals, projects: data.projects.map((p) => ({ code: p.code, pct: p.stats.pct, am196: p.am196?.pct ?? null })) },
      }),
    );
    return { id: saved.id, status: saved.status, recipients: saved.recipients, period: period.key };
  }

  /* ------------------------------------------------------------------ */

  async buildData(type: ReportType, period: Period) {
    const today = ecToday();
    const projectIds = await this.engine.internalProjectIds();
    const projects = projectIds.length ? await this.projectsRepo.find({ where: { id: In(projectIds) }, order: { code: 'ASC' } }) : [];
    const instances = projectIds.length
      ? await this.instRepo.find({
          where: { projectId: In(projectIds), periodEnd: Between(period.start, period.end) },
          relations: { template: true, staff: true },
          order: { dueDate: 'ASC' },
        })
      : [];
    // Pendientes acumulados: todo lo exigible no cumplido hasta el cierre del período
    const accumulated = projectIds.length
      ? await this.instRepo.find({
          where: { projectId: In(projectIds), status: In(['vencida', 'incompleta']), dueDate: LessThanOrEqual(period.end) },
          relations: { template: true, staff: true },
          order: { dueDate: 'ASC' },
        })
      : [];
    // Lo que sigue abierto hoy (para el semanal: pendientes por entregar)
    const openNow = projectIds.length
      ? await this.instRepo.find({
          where: { projectId: In(projectIds), status: In(['pendiente', 'incompleta']) },
          relations: { template: true, staff: true },
          order: { dueDate: 'ASC' },
        })
      : [];
    const am196 = projectIds.length
      ? await this.amRepo.find({ where: { projectId: In(projectIds) }, relations: { requirement: true } })
      : [];
    const startTs = new Date(`${period.start}T00:00:00-05:00`);
    const endTs = new Date(`${addDays(period.end, 1)}T00:00:00-05:00`);
    const alerts = projectIds.length
      ? await this.alertsRepo.find({ where: { projectId: In(projectIds), createdAt: Between(startTs, endTs) }, order: { createdAt: 'DESC' } })
      : [];
    const newFiles = projectIds.length
      ? await this.itemsRepo.find({ where: { projectId: In(projectIds), isFolder: false, fileCreatedAt: Between(startTs, endTs) } })
      : [];
    const amChanges = projectIds.length
      ? await this.historyRepo.find({ where: { projectId: In(projectIds), targetType: 'am196', action: 'CAMBIO_ESTADO', createdAt: Between(startTs, endTs) } })
      : [];
    const staff = await this.staffRepo.find();
    const assigns = await this.assignRepo.find({ where: { active: true } });

    const projData = projects.map((p) => {
      const list = instances.filter((i) => i.projectId === p.id);
      const items = am196.filter((a) => a.projectId === p.id);
      const am = am196Stats(items);
      const staffIds = [...new Set(assigns.filter((a) => a.projectId === p.id).map((a) => a.staffId))];
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        stats: computeStats(list, today),
        staff: staffIds
          .map((sid) => staff.find((s) => s.id === sid))
          .filter(Boolean)
          .map((s) => {
            const mine = list.filter((i) => i.staffId === s!.id);
            return { id: s!.id, name: s!.fullName, discipline: s!.discipline, stats: computeStats(mine, today) };
          }),
        incumplimientos: list.filter((i) => i.status === 'vencida' || (i.status === 'incompleta' && today > i.dueDate)),
        ejecutadas: list.filter((i) => i.status === 'ejecutada'),
        pendientes: openNow.filter((i) => i.projectId === p.id && i.dueDate >= today),
        acumulados: accumulated.filter((i) => i.projectId === p.id),
        am196: items.length ? am : null,
        am196Criticos: items
          .filter((a) => ['vencido', 'faltante', 'por_actualizar', 'observado'].includes(a.status))
          .sort((a, b) => ['vencido', 'observado', 'por_actualizar', 'faltante'].indexOf(a.status) - ['vencido', 'observado', 'por_actualizar', 'faltante'].indexOf(b.status)),
        novedades: {
          alertas: alerts.filter((a) => a.projectId === p.id),
          archivosNuevos: newFiles.filter((f) => f.projectId === p.id).length,
          am196Cambios: amChanges.filter((h) => h.projectId === p.id).length,
        },
      };
    });

    const staffData = staff
      .filter((s) => instances.some((i) => i.staffId === s.id) || assigns.some((a) => a.staffId === s.id))
      .map((s) => {
        const mine = instances.filter((i) => i.staffId === s.id);
        const st = computeStats(mine, today);
        return {
          id: s.id,
          name: s.fullName,
          discipline: s.discipline,
          projects: projects.filter((p) => assigns.some((a) => a.staffId === s.id && a.projectId === p.id)).map((p) => p.code),
          stats: st,
          acumulados: accumulated.filter((i) => i.staffId === s.id).length,
          semaforo: semaphore(st.pct),
        };
      })
      .sort((a, b) => (a.stats.pct ?? 101) - (b.stats.pct ?? 101));

    // Resumen de gestión: actividades ejecutadas por tipo
    const byTemplate = new Map<string, { name: string; ejecutadas: number; total: number }>();
    for (const i of instances) {
      const k = i.template?.code || i.templateId;
      const e = byTemplate.get(k) || { name: i.template?.name || k, ejecutadas: 0, total: 0 };
      e.total++;
      if (i.status === 'ejecutada') e.ejecutadas++;
      byTemplate.set(k, e);
    }

    const label =
      type === 'semanal'
        ? `semana del ${humanDate(period.start)} al ${humanDate(period.end)}`
        : `${MESES[Number(period.start.slice(5, 7)) - 1]} ${period.start.slice(0, 4)}`;

    return {
      type,
      period,
      label,
      generatedAt: today,
      title: `[SST ETINAR] Reporte ${type} de documentación interna — ${label}`,
      totals: computeStats(instances, today),
      am196Totals: am196.length ? am196Stats(am196) : null,
      accumulatedTotal: accumulated.length,
      projects: projData,
      staff: staffData,
      byTemplate: [...byTemplate.entries()].map(([code, v]) => ({ code, ...v })).sort((a, b) => a.code.localeCompare(b.code)),
      alertsCount: alerts.length,
      newFilesCount: newFiles.length,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Render: correo                                                       */
  /* ------------------------------------------------------------------ */

  private pct(v: number | null | undefined) {
    return v === null || v === undefined ? '—' : `${v}%`;
  }

  private dot(pct: number | null) {
    const c = { verde: '#079455', amarillo: '#dc6803', rojo: '#d92d20', gris: '#98a2b3' }[semaphore(pct)];
    return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c};margin-right:6px;vertical-align:middle"></span>`;
  }

  renderHtml(d: Awaited<ReturnType<InternalReportsService['buildData']>>): string {
    const th = 'style="text-align:left;padding:6px 8px;background:#f2f4f7;color:#344054;font-size:12px;border-bottom:1px solid #d0d5dd"';
    const td = 'style="padding:6px 8px;border-bottom:1px solid #eaecf0;font-size:13px;vertical-align:top"';
    const tdr = 'style="padding:6px 8px;border-bottom:1px solid #eaecf0;font-size:13px;text-align:right"';
    const T = d.totals;
    let h = `<div style="font-family:Arial,Helvetica,sans-serif;color:#16202c;max-width:860px">
<div style="background:#16202c;color:#fff;padding:16px 20px"><div style="font-size:12px;letter-spacing:1px;color:#f79009">DOCUMENTACIÓN INTERNA ETINAR</div>
<div style="font-size:20px;font-weight:bold;margin-top:4px">Reporte ${d.type} — ${escapeHtml(d.label)}</div>
<div style="font-size:12px;color:#d0d5dd;margin-top:4px">Generado el ${humanDate(d.generatedAt)} a partir de los registros del sistema y las carpetas de OneDrive vinculadas</div></div>
<table style="width:100%;border-collapse:collapse;margin:16px 0"><tr>
${[
  ['Cumplimiento', this.pct(T.pct)],
  ['Ejecutadas', T.ejecutadas],
  ['Incumplimientos', d.projects.reduce((a, p) => a + p.incumplimientos.length, 0)],
  ['Pendientes por entregar', d.projects.reduce((a, p) => a + p.pendientes.length, 0)],
  [d.type === 'mensual' ? 'Pendientes acumulados' : 'Archivos nuevos', d.type === 'mensual' ? d.accumulatedTotal : d.newFilesCount],
  ['AM 196', this.pct(d.am196Totals?.pct)],
]
  .map(([k, v]) => `<td style="border:1px solid #eaecf0;padding:10px;text-align:center"><div style="font-size:22px;font-weight:bold">${v}</div><div style="font-size:11px;color:#667085">${k}</div></td>`)
  .join('')}
</tr></table>`;

    // Consolidado por obra
    h += `<h3 style="margin:20px 0 8px">Consolidado por obra</h3><table style="width:100%;border-collapse:collapse"><tr>
<th ${th}>Obra</th><th ${th}>Cumplimiento</th><th ${th}>Ejecutadas</th><th ${th}>Pendientes</th><th ${th}>Incumplimientos</th><th ${th}>AM 196</th>${d.type === 'mensual' ? `<th ${th}>Acumulados</th>` : `<th ${th}>Novedades</th>`}</tr>`;
    for (const p of d.projects) {
      h += `<tr><td ${td}><b>${escapeHtml(p.code)}</b><br><span style="color:#667085">${escapeHtml(p.name)}</span></td>
<td ${td}>${this.dot(p.stats.pct)}${this.pct(p.stats.pct)}</td><td ${tdr}>${p.stats.ejecutadas}</td><td ${tdr}>${p.pendientes.length}</td><td ${tdr}>${p.incumplimientos.length}</td>
<td ${td}>${p.am196 ? `${this.dot(p.am196.pct)}${this.pct(p.am196.pct)}` : '—'}</td>
<td ${td}>${d.type === 'mensual' ? p.acumulados.length : `${p.novedades.archivosNuevos} archivo(s) nuevo(s), ${p.novedades.alertas.length} alerta(s)`}</td></tr>`;
    }
    h += '</table>';

    // Estado por asistente
    h += `<h3 style="margin:20px 0 8px">${d.type === 'mensual' ? 'Estado general por asistente' : 'Cumplimiento por asistente'}</h3><table style="width:100%;border-collapse:collapse"><tr>
<th ${th}>Asistente</th><th ${th}>Rol</th><th ${th}>Obra(s)</th><th ${th}>Cumplimiento</th><th ${th}>Ejecutadas</th><th ${th}>Incumpl.</th><th ${th}>Fuera de plazo</th>${d.type === 'mensual' ? `<th ${th}>Acumulados</th>` : ''}</tr>`;
    for (const s of d.staff) {
      h += `<tr><td ${td}>${escapeHtml(s.name)}</td><td ${td}>${DISCIPLINE_LABELS[s.discipline]}</td><td ${td}>${s.projects.join(', ')}</td>
<td ${td}>${this.dot(s.stats.pct)}${this.pct(s.stats.pct)}</td><td ${tdr}>${s.stats.ejecutadas}</td><td ${tdr}>${s.stats.vencidas}</td><td ${tdr}>${s.stats.tarde}</td>${d.type === 'mensual' ? `<td ${tdr}>${s.acumulados}</td>` : ''}</tr>`;
    }
    h += '</table>';

    // Desglose por obra
    for (const p of d.projects) {
      h += `<h3 style="margin:24px 0 6px;border-top:2px solid #f79009;padding-top:10px">${escapeHtml(p.code)} — ${escapeHtml(p.name)}</h3>`;
      if (p.incumplimientos.length) {
        h += `<div style="font-weight:bold;color:#b42318;margin:8px 0 4px">Incumplimientos (${p.incumplimientos.length})</div><ul style="margin:0;padding-left:18px">`;
        for (const i of p.incumplimientos.slice(0, 30)) h += `<li style="font-size:13px">${escapeHtml(i.template?.name)} — ${i.periodKey} — límite ${humanDate(i.dueDate)} — ${escapeHtml(i.staff?.fullName || 'sin responsable')}${i.status === 'incompleta' ? ' (incompleta)' : ''}</li>`;
        h += '</ul>';
      }
      if (d.type === 'semanal') {
        h += `<div style="font-weight:bold;margin:8px 0 4px">Ejecutadas (${p.ejecutadas.length})</div><ul style="margin:0;padding-left:18px">`;
        for (const i of p.ejecutadas.slice(0, 30)) h += `<li style="font-size:13px">${escapeHtml(i.template?.name)} — ${escapeHtml(i.staff?.fullName || '')}${i.late ? ' <span style="color:#b54708">(fuera de plazo)</span>' : ''} — ${i.evidenceCount} evidencia(s)</li>`;
        h += '</ul>';
        if (p.pendientes.length) {
          h += `<div style="font-weight:bold;margin:8px 0 4px">Pendientes por entregar (${p.pendientes.length})</div><ul style="margin:0;padding-left:18px">`;
          for (const i of p.pendientes.slice(0, 20)) h += `<li style="font-size:13px">${escapeHtml(i.template?.name)} — vence ${humanDate(i.dueDate)} — ${escapeHtml(i.staff?.fullName || '')}</li>`;
          h += '</ul>';
        }
        h += `<div style="font-weight:bold;margin:8px 0 4px">Novedades</div><ul style="margin:0;padding-left:18px"><li style="font-size:13px">${p.novedades.archivosNuevos} archivo(s) nuevo(s) en OneDrive</li><li style="font-size:13px">${p.novedades.am196Cambios} cambio(s) de estado en la matriz AM 196</li>`;
        for (const a of p.novedades.alertas.slice(0, 10)) h += `<li style="font-size:13px">${escapeHtml(a.message)}</li>`;
        h += '</ul>';
      } else {
        if (p.acumulados.length) {
          h += `<div style="font-weight:bold;margin:8px 0 4px">Pendientes acumulados (${p.acumulados.length})</div><ul style="margin:0;padding-left:18px">`;
          for (const i of p.acumulados.slice(0, 30)) h += `<li style="font-size:13px">${escapeHtml(i.template?.name)} — ${i.periodKey} — ${escapeHtml(i.staff?.fullName || '')}</li>`;
          if (p.acumulados.length > 30) h += `<li style="font-size:13px">… ver detalle en el Excel adjunto</li>`;
          h += '</ul>';
        }
      }
      if (p.am196) {
        h += `<div style="font-weight:bold;margin:8px 0 4px">Matriz AM 196: ${this.pct(p.am196.pct)} — cumple ${p.am196.cumple}, por actualizar ${p.am196.por_actualizar}, vencidos ${p.am196.vencido}, faltantes ${p.am196.faltante}, observados ${p.am196.observado}</div>`;
        const crit = p.am196Criticos.filter((a) => a.status !== 'faltante').slice(0, 15);
        if (crit.length) {
          h += '<ul style="margin:0;padding-left:18px">';
          for (const a of crit) h += `<li style="font-size:13px">${a.requirement?.code} ${escapeHtml(a.requirement?.description.slice(0, 100))} — <b>${a.status.replace('_', ' ')}</b>${a.expiresAt ? ` (${humanDate(a.expiresAt)})` : ''}</li>`;
          h += '</ul>';
        }
      }
    }

    if (d.type === 'mensual' && d.byTemplate.length) {
      h += `<h3 style="margin:24px 0 8px">Resumen de gestión del mes</h3><table style="width:100%;border-collapse:collapse"><tr><th ${th}>Código</th><th ${th}>Actividad</th><th ${th}>Ejecutadas / programadas</th></tr>`;
      for (const t of d.byTemplate) h += `<tr><td ${td}>${t.code}</td><td ${td}>${escapeHtml(t.name)}</td><td ${tdr}>${t.ejecutadas} / ${t.total}</td></tr>`;
      h += '</table>';
    }

    h += `<p style="color:#667085;font-size:12px;margin-top:24px">Cumplimiento = actividades ejecutadas ÷ actividades ya exigibles (ejecutadas + no ejecutadas o incompletas con plazo vencido). Detalle completo en el archivo adjunto.</p></div>`;
    return h;
  }

  renderText(d: Awaited<ReturnType<InternalReportsService['buildData']>>): string {
    let t = `${d.title}\n\nCumplimiento general: ${this.pct(d.totals.pct)} | Ejecutadas: ${d.totals.ejecutadas} | Vencidas: ${d.totals.vencidas} | Pendientes: ${d.totals.pendientes}\n\n`;
    for (const p of d.projects) {
      t += `${p.code} — ${p.name}: ${this.pct(p.stats.pct)} (ejecutadas ${p.stats.ejecutadas}, incumplimientos ${p.incumplimientos.length}, AM 196 ${this.pct(p.am196?.pct)})\n`;
    }
    t += '\nPor asistente:\n';
    for (const s of d.staff) t += `  ${s.name} (${DISCIPLINE_LABELS[s.discipline]}): ${this.pct(s.stats.pct)}\n`;
    return t;
  }

  /* ------------------------------------------------------------------ */
  /* Excel                                                                */
  /* ------------------------------------------------------------------ */

  async buildExcel(d: Awaited<ReturnType<InternalReportsService['buildData']>>): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SST ETINAR';
    const head = (ws: ExcelJS.Worksheet) => {
      const r = ws.getRow(1);
      r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16202C' } };
      ws.views = [{ state: 'frozen', ySplit: 1 }];
    };

    const ws1 = wb.addWorksheet('Por obra');
    ws1.columns = [
      { header: 'Código', key: 'code', width: 14 },
      { header: 'Obra', key: 'name', width: 36 },
      { header: '% cumplimiento', key: 'pct', width: 15 },
      { header: 'Programadas', key: 'total', width: 12 },
      { header: 'Ejecutadas', key: 'ej', width: 11 },
      { header: 'Fuera de plazo', key: 'tarde', width: 13 },
      { header: 'Pendientes', key: 'pend', width: 11 },
      { header: 'Incompletas', key: 'inc', width: 11 },
      { header: 'Vencidas', key: 'ven', width: 10 },
      { header: 'Pend. acumulados', key: 'acu', width: 15 },
      { header: '% AM 196', key: 'am', width: 10 },
      { header: 'AM196 faltantes', key: 'amf', width: 14 },
      { header: 'AM196 vencidos', key: 'amv', width: 14 },
    ];
    for (const p of d.projects) {
      ws1.addRow({ code: p.code, name: p.name, pct: p.stats.pct, total: p.stats.total, ej: p.stats.ejecutadas, tarde: p.stats.tarde, pend: p.stats.pendientes, inc: p.stats.incompletas, ven: p.stats.vencidas, acu: p.acumulados.length, am: p.am196?.pct ?? null, amf: p.am196?.faltante ?? null, amv: p.am196?.vencido ?? null });
    }
    head(ws1);

    const ws2 = wb.addWorksheet('Por asistente');
    ws2.columns = [
      { header: 'Asistente', key: 'n', width: 30 },
      { header: 'Rol', key: 'r', width: 24 },
      { header: 'Obras', key: 'o', width: 24 },
      { header: '% cumplimiento', key: 'pct', width: 15 },
      { header: 'Programadas', key: 't', width: 12 },
      { header: 'Ejecutadas', key: 'e', width: 11 },
      { header: 'Fuera de plazo', key: 'l', width: 13 },
      { header: 'Vencidas', key: 'v', width: 10 },
      { header: 'Pend. acumulados', key: 'a', width: 15 },
      { header: 'Semáforo', key: 's', width: 10 },
    ];
    for (const s of d.staff) ws2.addRow({ n: s.name, r: DISCIPLINE_LABELS[s.discipline], o: s.projects.join(', '), pct: s.stats.pct, t: s.stats.total, e: s.stats.ejecutadas, l: s.stats.tarde, v: s.stats.vencidas, a: s.acumulados, s: s.semaforo });
    head(ws2);

    const ws3 = wb.addWorksheet('Actividades del período');
    ws3.columns = [
      { header: 'Obra', key: 'p', width: 14 },
      { header: 'Código', key: 'c', width: 9 },
      { header: 'Actividad', key: 'a', width: 50 },
      { header: 'Período', key: 'k', width: 12 },
      { header: 'Responsable', key: 'r', width: 26 },
      { header: 'Fecha límite', key: 'd', width: 12 },
      { header: 'Estado', key: 's', width: 12 },
      { header: 'Evidencias', key: 'e', width: 10 },
      { header: 'Fuera de plazo', key: 'l', width: 13 },
      { header: 'Revisión', key: 'rv', width: 12 },
    ];
    for (const p of d.projects) {
      for (const i of [...p.ejecutadas, ...p.incumplimientos, ...p.pendientes.filter((x) => x.periodEnd >= d.period.start && x.periodEnd <= d.period.end)]) {
        ws3.addRow({ p: p.code, c: i.template?.code, a: i.template?.name, k: i.periodKey, r: i.staff?.fullName, d: i.dueDate, s: i.status, e: i.evidenceCount, l: i.late ? 'Sí' : '', rv: i.review || '' });
      }
    }
    head(ws3);

    const ws4 = wb.addWorksheet('Pendientes acumulados');
    ws4.columns = [
      { header: 'Obra', key: 'p', width: 14 },
      { header: 'Actividad', key: 'a', width: 50 },
      { header: 'Período', key: 'k', width: 12 },
      { header: 'Responsable', key: 'r', width: 26 },
      { header: 'Fecha límite', key: 'd', width: 12 },
      { header: 'Estado', key: 's', width: 12 },
    ];
    for (const p of d.projects) for (const i of p.acumulados) ws4.addRow({ p: p.code, a: i.template?.name, k: i.periodKey, r: i.staff?.fullName, d: i.dueDate, s: i.status });
    head(ws4);

    const ws5 = wb.addWorksheet('AM 196 críticos');
    ws5.columns = [
      { header: 'Obra', key: 'p', width: 14 },
      { header: 'Código', key: 'c', width: 9 },
      { header: 'Requisito', key: 'r', width: 70 },
      { header: 'Estado', key: 's', width: 14 },
      { header: 'Última actualización', key: 'u', width: 18 },
      { header: 'Vence', key: 'v', width: 12 },
    ];
    for (const p of d.projects) for (const a of p.am196Criticos) ws5.addRow({ p: p.code, c: a.requirement?.code, r: a.requirement?.description, s: a.status, u: a.lastUpdateDate, v: a.expiresAt });
    head(ws5);

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /* ------------------------------------------------------------------ */
  /* PDF (mensual)                                                        */
  /* ------------------------------------------------------------------ */

  async buildPdf(d: Awaited<ReturnType<InternalReportsService['buildData']>>): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.rect(0, 0, doc.page.width, 80).fill('#16202C');
      doc.fillColor('#F79009').fontSize(9).text('DOCUMENTACIÓN INTERNA ETINAR', 40, 22);
      doc.fillColor('#FFFFFF').fontSize(16).text(`Reporte ${d.type} — ${d.label}`, 40, 36);
      doc.fillColor('#D0D5DD').fontSize(8).text(`Generado el ${humanDate(d.generatedAt)} con registros reales del sistema y OneDrive`, 40, 58);
      doc.fillColor('#16202C').moveDown(3);
      doc.y = 100;

      doc.fontSize(11).text(
        `Cumplimiento general: ${this.pct(d.totals.pct)}   ·   Ejecutadas: ${d.totals.ejecutadas}   ·   Vencidas: ${d.totals.vencidas}   ·   Pendientes acumulados: ${d.accumulatedTotal}   ·   AM 196: ${this.pct(d.am196Totals?.pct)}`,
      );
      doc.moveDown();

      const table = (title: string, headers: string[], widths: number[], rows: (string | number)[][]) => {
        doc.fontSize(12).fillColor('#16202C').text(title, 40);
        doc.moveDown(0.3);
        let y = doc.y;
        const draw = (cells: (string | number)[], bold: boolean) => {
          let x = 40;
          const h = 16;
          if (y > doc.page.height - 60) {
            doc.addPage();
            y = 40;
          }
          if (bold) doc.rect(40, y - 2, widths.reduce((a, b) => a + b, 0), h).fill('#F2F4F7');
          doc.fillColor('#16202C').fontSize(8);
          cells.forEach((c, i) => {
            doc.text(String(c ?? ''), x + 3, y + 2, { width: widths[i] - 6, height: h, ellipsis: true, lineBreak: false });
            x += widths[i];
          });
          y += h;
        };
        draw(headers, true);
        for (const r of rows) draw(r, false);
        doc.y = y + 10;
        doc.x = 40;
      };

      table(
        'Cumplimiento por obra',
        ['Obra', 'Nombre', '% Cumpl.', 'Ejec.', 'Venc.', 'Acum.', '% AM196'],
        [60, 190, 55, 45, 45, 45, 75],
        d.projects.map((p) => [p.code, p.name, this.pct(p.stats.pct), p.stats.ejecutadas, p.stats.vencidas, p.acumulados.length, this.pct(p.am196?.pct)]),
      );
      table(
        'Estado general por asistente',
        ['Asistente', 'Rol', 'Obras', '% Cumpl.', 'Ejec.', 'Venc.', 'Acum.'],
        [130, 100, 90, 55, 40, 40, 60],
        d.staff.map((s) => [s.name, DISCIPLINE_LABELS[s.discipline], s.projects.join(', '), this.pct(s.stats.pct), s.stats.ejecutadas, s.stats.vencidas, s.acumulados]),
      );
      table(
        'Resumen de gestión (ejecutadas / programadas)',
        ['Código', 'Actividad', 'Ejecutadas', 'Programadas'],
        [60, 315, 70, 70],
        d.byTemplate.map((t) => [t.code, t.name, t.ejecutadas, t.total]),
      );
      doc.end();
    });
  }

  /** Reporte bajo demanda para descargar (no se envía). */
  async download(type: ReportType, key: string | undefined, format: 'xlsx' | 'pdf' | 'html') {
    const period = this.periodOf(type, key);
    const data = await this.buildData(type, period);
    if (format === 'pdf') return { data: await this.buildPdf(data), period };
    if (format === 'html') return { data: Buffer.from(this.renderHtml(data), 'utf8'), period };
    return { data: await this.buildExcel(data), period };
  }

  history() {
    return this.reportsRepo.find({ order: { createdAt: 'DESC' }, take: 50 });
  }
}
