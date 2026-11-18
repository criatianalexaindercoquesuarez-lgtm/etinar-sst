import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import {
  ActivityInstance,
  ActivityStatus,
  ActivityTemplate,
  Am196Item,
  Am196Requirement,
  Am196Status,
  DriveItem,
  DriveLink,
  Evidence,
  InternalAlert,
  InternalStaff,
  ProjectActivityConfig,
  StaffAssignment,
  TrackingHistory,
} from './internal.entities';
import { Project } from '../entities/project.entity';
import { StoredFile } from '../entities/stored-file.entity';
import { DriveSyncService } from './drive-sync.service';
import { OneDriveService } from './onedrive.service';
import { InternalSettingsService } from './settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../common/audit.service';
import {
  addDays,
  diffDays,
  DISCIPLINE_FOLDER_HINTS,
  ecDate,
  folderHasDiscipline,
  ecToday,
  humanDate,
  matchesKeywords,
  norm,
  periodsBetween,
} from './periods';

const AUTO_EVIDENCE_CAP = 25;

/**
 * Motor automático de DOCUMENTACIÓN INTERNA ETINAR.
 *
 * Cada día (06:30, hora Ecuador) y bajo demanda:
 *  1. Lee las carpetas de OneDrive vinculadas (índice de metadatos).
 *  2. Sube a OneDrive las cargas hechas desde el sistema que quedaron pendientes.
 *  3. Genera las actividades del período para cada asistente según su obra.
 *  4. Reconoce la evidencia en OneDrive y calcula el estado de cada actividad:
 *     ejecutada / pendiente / incompleta / vencida.
 *  5. Evalúa la matriz AM 196 de cada obra: cumple / por actualizar / vencido / faltante.
 *  6. Genera y resuelve alertas; envía el resumen diario de alertas nuevas.
 *  7. Dispara los reportes semanal y mensual cuando corresponde.
 */
@Injectable()
export class InternalEngineService implements OnApplicationBootstrap {
  private readonly logger = new Logger(InternalEngineService.name);
  private busy = false;
  /** Se inyecta desde el módulo para evitar dependencia circular con reportes. */
  reportsRunner?: (today: string) => Promise<any>;

  constructor(
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    @InjectRepository(DriveLink) private linksRepo: Repository<DriveLink>,
    @InjectRepository(DriveItem) private itemsRepo: Repository<DriveItem>,
    @InjectRepository(InternalStaff) private staffRepo: Repository<InternalStaff>,
    @InjectRepository(StaffAssignment) private assignRepo: Repository<StaffAssignment>,
    @InjectRepository(ActivityTemplate) private templatesRepo: Repository<ActivityTemplate>,
    @InjectRepository(ProjectActivityConfig) private configRepo: Repository<ProjectActivityConfig>,
    @InjectRepository(ActivityInstance) private instRepo: Repository<ActivityInstance>,
    @InjectRepository(Am196Requirement) private reqRepo: Repository<Am196Requirement>,
    @InjectRepository(Am196Item) private amRepo: Repository<Am196Item>,
    @InjectRepository(Evidence) private evidenceRepo: Repository<Evidence>,
    @InjectRepository(InternalAlert) private alertsRepo: Repository<InternalAlert>,
    @InjectRepository(TrackingHistory) private historyRepo: Repository<TrackingHistory>,
    @InjectRepository(StoredFile) private storedRepo: Repository<StoredFile>,
    private driveSync: DriveSyncService,
    private onedrive: OneDriveService,
    private settings: InternalSettingsService,
    private notifications: NotificationsService,
    private audit: AuditService,
  ) {}

  onApplicationBootstrap() {
    // En Render (plan gratuito) el servidor se duerme; al despertar se pone al día.
    setTimeout(() => {
      this.run({ scan: false, reports: false, source: 'arranque' }).catch((e) =>
        this.logger.error(`Evaluación inicial falló: ${e}`),
      );
    }, 15000);
  }

  @Cron('30 6 * * *', { timeZone: 'America/Guayaquil' })
  async dailyCron() {
    await this.run({ scan: true, reports: true, source: 'cron' });
  }

  /** Obras con seguimiento interno: tienen personal asignado o carpetas vinculadas. */
  async internalProjectIds(): Promise<string[]> {
    const a = await this.assignRepo.find({ where: { active: true }, select: { projectId: true } });
    const l = await this.linksRepo.find({ select: { projectId: true } });
    return [...new Set([...a.map((x) => x.projectId), ...l.map((x) => x.projectId)])];
  }

  async run(opts: { scan?: boolean; reports?: boolean; source?: string; projectId?: string } = {}) {
    if (this.busy) return { skipped: true, reason: 'Ya hay una ejecución en curso' };
    this.busy = true;
    const t0 = Date.now();
    const today = ecToday();
    const result: any = { today, source: opts.source || 'manual' };
    try {
      if (opts.scan && this.onedrive.configured) {
        result.scan = opts.projectId ? await this.driveSync.scanProject(opts.projectId) : await this.driveSync.scanAll();
      } else if (opts.scan) {
        result.scan = { skipped: 'Microsoft 365 no configurado' };
      }
      result.pendingUploads = await this.pushPendingUploads();
      result.instancesCreated = await this.ensureInstances(today);
      result.activities = await this.evaluateActivities(today, opts.projectId);
      result.am196ItemsCreated = await this.ensureAm196Items();
      result.am196 = await this.evaluateAm196(today, opts.projectId);
      const newAlerts = await this.syncAlerts(today);
      result.alertsNew = newAlerts.length;
      if (opts.scan) result.alertDigest = await this.sendAlertDigest();
      if (opts.reports && this.reportsRunner) result.reports = await this.reportsRunner(today);
      result.ms = Date.now() - t0;
      this.logger.log(`Documentación interna: ${JSON.stringify(result).slice(0, 400)}`);
      return result;
    } finally {
      this.busy = false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* 2. Cargas pendientes                                                 */
  /* ------------------------------------------------------------------ */

  async pushPendingUploads() {
    if (!this.onedrive.configured) return { skipped: true };
    const pending = await this.evidenceRepo.find({ where: { syncStatus: 'pendiente_onedrive' } });
    let ok = 0;
    let failed = 0;
    for (const ev of pending) {
      try {
        const link = ev.linkId ? await this.linksRepo.findOne({ where: { id: ev.linkId } }) : null;
        const file = ev.storedFileId ? await this.storedRepo.findOne({ where: { id: ev.storedFileId } }) : null;
        if (!link || !link.driveId || !link.itemId || !file) {
          failed++;
          continue;
        }
        const folder = (ev.path || '').split('/').slice(0, -1).join('/');
        const parentId = folder ? await this.onedrive.ensureFolder(link.driveId, link.itemId, folder) : link.itemId;
        const it = await this.onedrive.uploadFile(link.driveId, parentId, ev.fileName, Buffer.from(file.data));
        const rel = folder ? `${folder}/${it.name}` : it.name;
        const row = await this.driveSync.indexUploaded(link, it, rel, parentId);
        ev.driveItemRowId = row.id;
        ev.path = rel;
        ev.webUrl = row.webUrl;
        ev.syncStatus = 'sincronizado';
        ev.storedFileId = null;
        await this.evidenceRepo.save(ev);
        // Ya está en OneDrive: se elimina la copia temporal para no duplicar.
        await this.storedRepo.delete(file.id);
        await this.history(ev.projectId, ev.targetType, ev.targetId, 'EVIDENCIA_SUBIDA_ONEDRIVE', null, null, `${rel} sincronizado con OneDrive`, 'sistema');
        ok++;
      } catch (err) {
        this.logger.warn(`No se pudo subir la evidencia pendiente ${ev.id}: ${err}`);
        failed++;
      }
    }
    return { pending: pending.length, ok, failed };
  }

  /* ------------------------------------------------------------------ */
  /* 3. Generación de actividades por período                             */
  /* ------------------------------------------------------------------ */

  async ensureInstances(today: string): Promise<number> {
    const backfillWeeks = Number(await this.settings.get('backfillWeeks')) || 8;
    const earliest = addDays(today, -7 * backfillWeeks);
    const assignments = await this.assignRepo.find({ where: { active: true }, relations: { staff: true } });
    const templates = await this.templatesRepo.find({ where: { active: true } });
    const configs = await this.configRepo.find();
    const cfgKey = (p: string, t: string) => `${p}|${t}`;
    const cfgMap = new Map(configs.map((c) => [cfgKey(c.projectId, c.templateId), c]));

    // Por obra y disciplina: asignaciones vigentes
    const byProjDisc = new Map<string, StaffAssignment[]>();
    for (const a of assignments) {
      if (!a.staff?.active) continue;
      const k = `${a.projectId}|${a.staff.discipline}`;
      byProjDisc.set(k, [...(byProjDisc.get(k) || []), a]);
    }

    const existing = await this.instRepo.find({
      select: { id: true, projectId: true, templateId: true, periodKey: true, staffId: true },
    });
    const existingMap = new Map(existing.map((e) => [`${e.projectId}|${e.templateId}|${e.periodKey}`, e]));
    const toCreate: ActivityInstance[] = [];

    for (const [k, list] of byProjDisc) {
      const [projectId, discipline] = k.split('|');
      for (const t of templates.filter((x) => x.discipline === discipline)) {
        const cfg = cfgMap.get(cfgKey(projectId, t.id));
        if (cfg && !cfg.enabled) continue;
        const start = list.map((a) => a.startDate).sort()[0];
        const from = start > earliest ? start : earliest;
        for (const p of periodsBetween(t.frequency, from, today)) {
          const key = `${projectId}|${t.id}|${p.key}`;
          if (existingMap.has(key)) continue;
          // Responsable: el configurado para la obra, o el asistente asignado en ese período.
          const resp =
            (cfg?.responsibleStaffId && list.find((a) => a.staffId === cfg.responsibleStaffId)) ||
            list.find((a) => a.startDate <= p.end && (!a.endDate || a.endDate >= p.start)) ||
            null;
          if (!resp) continue;
          toCreate.push(
            this.instRepo.create({
              templateId: t.id,
              projectId,
              staffId: resp.staffId,
              periodKey: p.key,
              periodStart: p.start,
              periodEnd: p.end,
              dueDate: addDays(p.end, t.graceDays),
              status: 'pendiente',
            }),
          );
          existingMap.set(key, toCreate[toCreate.length - 1]);
        }
      }
    }
    for (let i = 0; i < toCreate.length; i += 300) await this.instRepo.save(toCreate.slice(i, i + 300));
    return toCreate.length;
  }

  /* ------------------------------------------------------------------ */
  /* 4. Reconocimiento de evidencia y estado de actividades               */
  /* ------------------------------------------------------------------ */

  private fileDate(f: DriveItem): string {
    return ecDate(f.fileCreatedAt || f.fileModifiedAt || f.firstSeenAt) || '1970-01-01';
  }

  /**
   * Archivos candidatos según carpeta configurada o palabras clave.
   * Con palabras clave, si la obra tiene carpetas por disciplina (SST, AMBIENTE,
   * MÉDICO, SOCIAL…), solo se buscan en la carpeta de la disciplina, para no
   * mezclar evidencias entre roles (ej. "inspección" de SST vs. ambiental).
   */
  private candidates(
    files: DriveItem[],
    links: DriveLink[],
    opts: { folderPath?: string | null; linkId?: string | null; keywords?: string | null; purposes: string[]; discipline?: string },
  ): DriveItem[] {
    if (opts.folderPath) {
      const prefix = norm(opts.folderPath.replace(/^\/+|\/+$/g, '')) + '/';
      return files.filter((f) => (!opts.linkId || f.linkId === opts.linkId) && f.pathNorm.startsWith(prefix));
    }
    if (!opts.keywords) return [];
    const preferred = links.filter((l) => opts.purposes.includes(l.purpose)).map((l) => l.id);
    let pool = preferred.length ? files.filter((f) => preferred.includes(f.linkId)) : files;
    if (opts.discipline) {
      const d = opts.discipline;
      const ownLinks = new Set(links.filter((l) => l.purpose === d).map((l) => l.id));
      const own = pool.filter((f) => ownLinks.has(f.linkId) || folderHasDiscipline(f.pathNorm, d));
      if (own.length) pool = own;
      else {
        const others = Object.keys(DISCIPLINE_FOLDER_HINTS).filter((x) => x !== d);
        pool = pool.filter((f) => !others.some((o) => folderHasDiscipline(f.pathNorm, o)));
      }
    }
    return pool.filter((f) => matchesKeywords(f.pathNorm, opts.keywords));
  }

  async evaluateActivities(today: string, onlyProjectId?: string) {
    const projectIds = onlyProjectId ? [onlyProjectId] : await this.internalProjectIds();
    const templates = new Map((await this.templatesRepo.find()).map((t) => [t.id, t]));
    const counts: Record<string, number> = {};
    let changed = 0;

    for (const projectId of projectIds) {
      const links = await this.linksRepo.find({ where: { projectId } });
      const files = await this.itemsRepo.find({ where: { projectId, isFolder: false, removed: false } });
      const configs = new Map((await this.configRepo.find({ where: { projectId } })).map((c) => [c.templateId, c]));
      const instances = await this.instRepo.find({ where: { projectId }, order: { periodStart: 'ASC' } });
      const evidence = await this.evidenceRepo.find({ where: { projectId, targetType: 'activity' } });
      const evByTarget = new Map<string, Evidence[]>();
      for (const e of evidence) evByTarget.set(e.targetId, [...(evByTarget.get(e.targetId) || []), e]);

      const groups = new Map<string, ActivityInstance[]>();
      for (const i of instances) groups.set(i.templateId, [...(groups.get(i.templateId) || []), i]);

      for (const [templateId, list] of groups) {
        const t = templates.get(templateId);
        if (!t) continue;
        const cfg = configs.get(templateId);
        const explicitIds = new Set(
          list.flatMap((i) => (evByTarget.get(i.id) || []).filter((e) => e.source !== 'auto').map((e) => e.driveItemRowId)),
        );
        const pool = this.candidates(files, links, {
          folderPath: cfg?.folderPath,
          linkId: cfg?.linkId,
          keywords: t.keywords,
          purposes: [t.discipline, 'general'],
          discipline: t.discipline,
        })
          .filter((f) => !explicitIds.has(f.id))
          .map((f) => ({ f, d: this.fileDate(f) }))
          .sort((a, b) => a.d.localeCompare(b.d));
        const used = new Set<string>();

        for (const inst of list) {
          const explicit = (evByTarget.get(inst.id) || []).filter((e) => e.source !== 'auto');
          const auto: { f: DriveItem; d: string }[] = [];
          for (const c of pool) {
            if (!used.has(c.f.id) && c.d >= inst.periodStart && c.d <= inst.periodEnd) {
              auto.push(c);
              used.add(c.f.id);
            }
          }
          // Archivo entregado dentro del plazo de gracia (después del cierre del período)
          if (auto.length + explicit.length < t.minEvidence) {
            for (const c of pool) {
              if (auto.length + explicit.length >= t.minEvidence) break;
              if (!used.has(c.f.id) && c.d > inst.periodEnd && c.d <= inst.dueDate) {
                auto.push(c);
                used.add(c.f.id);
              }
            }
          }
          changed += await this.persistAuto(inst.projectId, 'activity', inst.id, evByTarget.get(inst.id) || [], auto.map((a) => a.f), inst.review === 'validada');

          // Fechas de todas las evidencias, para saber cuándo se completó
          const dates = [
            ...auto.map((a) => a.d),
            ...explicit.map((e) => ecDate(e.fileDate || e.createdAt) || today),
          ].sort();
          const count = dates.length;

          // Nueva evidencia después de una observación: vuelve a evaluación automática
          let dirty = false;
          if (inst.review === 'observada' && inst.reviewedAt) {
            const newer = explicit.some((e) => e.createdAt > inst.reviewedAt!) ||
              auto.some((a) => (a.f.firstSeenAt || new Date(0)) > inst.reviewedAt!);
            if (newer) {
              await this.history(projectId, 'activity', inst.id, 'NUEVA_EVIDENCIA_TRAS_OBSERVACION', null, null, 'Se cargó nueva evidencia; vuelve a evaluación', 'sistema');
              inst.review = null;
              dirty = true;
            }
          }

          let status: ActivityStatus;
          let completedDate: string | null = null;
          if (inst.review === 'no_aplica') status = 'no_aplica';
          else if (inst.review === 'validada') {
            status = 'ejecutada';
            completedDate = dates[Math.max(0, t.minEvidence - 1)] || ecDate(inst.reviewedAt) || today;
          } else if (inst.review === 'observada') status = 'incompleta';
          else if (count >= t.minEvidence) {
            status = 'ejecutada';
            completedDate = dates[t.minEvidence - 1];
          } else if (today > inst.dueDate) status = count > 0 ? 'incompleta' : 'vencida';
          else status = count > 0 ? 'incompleta' : 'pendiente';

          const late = Boolean(completedDate && completedDate > inst.dueDate);
          const completedAt = completedDate ? new Date(`${completedDate}T12:00:00-05:00`) : null;
          if (
            dirty ||
            inst.status !== status ||
            inst.evidenceCount !== count ||
            inst.late !== late ||
            (inst.completedAt?.toISOString() || null) !== (completedAt?.toISOString() || null)
          ) {
            if (inst.status !== status) {
              await this.history(projectId, 'activity', inst.id, 'CAMBIO_ESTADO', inst.status, status, `${t.name} (${inst.periodKey}) — ${count} evidencia(s)`, 'sistema');
              changed++;
            }
            inst.status = status;
            inst.evidenceCount = count;
            inst.late = late;
            inst.completedAt = completedAt;
            inst.source = inst.review === 'validada' ? 'manual' : count ? 'auto' : null;
            await this.instRepo.save(inst);
          }
          counts[status] = (counts[status] || 0) + 1;
        }
      }
    }
    return { ...counts, changed };
  }

  /** Sincroniza las evidencias "auto" de un objetivo con el conjunto calculado. */
  private async persistAuto(projectId: string, targetType: string, targetId: string, current: Evidence[], files: DriveItem[], keepExisting: boolean) {
    const autoNow = current.filter((e) => e.source === 'auto');
    const wanted = new Map(files.slice(0, AUTO_EVIDENCE_CAP).map((f) => [f.id, f]));
    let changes = 0;
    const toAdd: Evidence[] = [];
    for (const [id, f] of wanted) {
      if (autoNow.some((e) => e.driveItemRowId === id)) continue;
      toAdd.push(
        this.evidenceRepo.create({
          targetType,
          targetId,
          projectId,
          driveItemRowId: id,
          fileName: f.name,
          linkId: f.linkId,
          path: f.path,
          webUrl: f.webUrl,
          fileDate: f.fileCreatedAt || f.fileModifiedAt,
          source: 'auto',
          syncStatus: 'sincronizado',
          addedBy: f.createdByName || f.modifiedByName || null,
        }),
      );
    }
    if (toAdd.length) {
      await this.evidenceRepo.save(toAdd);
      changes += toAdd.length;
    }
    if (!keepExisting) {
      const stale = autoNow.filter((e) => !wanted.has(e.driveItemRowId || ''));
      if (stale.length) {
        await this.evidenceRepo.delete({ id: In(stale.map((s) => s.id)) });
        changes += stale.length;
      }
    }
    return changes;
  }

  /* ------------------------------------------------------------------ */
  /* 5. Matriz AM 196                                                     */
  /* ------------------------------------------------------------------ */

  async ensureAm196Items(): Promise<number> {
    const projectIds = await this.internalProjectIds();
    if (!projectIds.length) return 0;
    const reqs = await this.reqRepo.find({ where: { active: true } });
    const existing = await this.amRepo.find({ select: { projectId: true, requirementId: true } });
    const have = new Set(existing.map((e) => `${e.projectId}|${e.requirementId}`));
    const toCreate: Am196Item[] = [];
    for (const p of projectIds) {
      for (const r of reqs) {
        if (have.has(`${p}|${r.id}`)) continue;
        toCreate.push(this.amRepo.create({ projectId: p, requirementId: r.id, applies: true, status: 'faltante' }));
      }
    }
    for (let i = 0; i < toCreate.length; i += 300) await this.amRepo.save(toCreate.slice(i, i + 300));
    return toCreate.length;
  }

  async evaluateAm196(today: string, onlyProjectId?: string) {
    const projectIds = onlyProjectId ? [onlyProjectId] : await this.internalProjectIds();
    const reqs = new Map((await this.reqRepo.find()).map((r) => [r.id, r]));
    const counts: Record<string, number> = {};
    let changed = 0;
    for (const projectId of projectIds) {
      const links = await this.linksRepo.find({ where: { projectId } });
      const files = await this.itemsRepo.find({ where: { projectId, isFolder: false, removed: false } });
      const items = await this.amRepo.find({ where: { projectId } });
      const evidence = await this.evidenceRepo.find({ where: { projectId, targetType: 'am196' } });
      const evByTarget = new Map<string, Evidence[]>();
      for (const e of evidence) evByTarget.set(e.targetId, [...(evByTarget.get(e.targetId) || []), e]);

      for (const item of items) {
        const r = reqs.get(item.requirementId);
        if (!r) continue;
        const current = evByTarget.get(item.id) || [];
        const explicit = current.filter((e) => e.source !== 'auto');
        const explicitIds = new Set(explicit.map((e) => e.driveItemRowId));
        const auto = this.candidates(files, links, {
          folderPath: item.folderPath,
          linkId: item.linkId,
          keywords: r.keywords,
          purposes: ['am196', 'ministerio'],
        })
          .filter((f) => !explicitIds.has(f.id))
          .sort((a, b) => (b.fileModifiedAt?.getTime() || 0) - (a.fileModifiedAt?.getTime() || 0));
        changed += await this.persistAuto(projectId, 'am196', item.id, current, auto, item.review === 'validada');

        const dates = [
          ...auto.map((f) => ecDate(f.fileModifiedAt || f.fileCreatedAt) || today),
          ...explicit.map((e) => ecDate(e.fileDate || e.createdAt) || today),
        ].sort();
        const count = dates.length;
        const last = dates.length ? dates[dates.length - 1] : null;

        let dirty = false;
        if (item.review === 'observada' && item.reviewedAt) {
          const newer = explicit.some((e) => e.createdAt > item.reviewedAt!) || auto.some((f) => (f.firstSeenAt || new Date(0)) > item.reviewedAt!);
          if (newer) {
            dirty = true;
            await this.history(projectId, 'am196', item.id, 'NUEVA_EVIDENCIA_TRAS_OBSERVACION', null, null, `${r.code}: nueva evidencia, vuelve a evaluación`, 'sistema');
            item.review = null;
          }
        }

        const lastUpdate = item.review === 'validada' && !last ? ecDate(item.reviewedAt) : last;
        const expiresAt = lastUpdate && r.validityDays ? addDays(lastUpdate, r.validityDays) : null;
        let status: Am196Status;
        if (!item.applies || item.review === 'no_aplica') status = 'no_aplica';
        else if (item.review === 'observada') status = 'observado';
        else if (!count && item.review !== 'validada') status = 'faltante';
        else if (expiresAt && today > expiresAt) status = 'vencido';
        else if (expiresAt && diffDays(expiresAt, today) <= Math.min(30, Math.ceil((r.validityDays || 0) / 4))) status = 'por_actualizar';
        else status = 'cumple';

        if (dirty || item.status !== status || item.evidenceCount !== count || item.lastUpdateDate !== lastUpdate || item.expiresAt !== expiresAt) {
          if (item.status !== status) {
            await this.history(projectId, 'am196', item.id, 'CAMBIO_ESTADO', item.status, status, `${r.code} — ${r.description.slice(0, 80)}`, 'sistema');
            changed++;
          }
          item.status = status;
          item.evidenceCount = count;
          item.lastUpdateDate = lastUpdate;
          item.expiresAt = expiresAt;
          await this.amRepo.save(item);
        }
        counts[status] = (counts[status] || 0) + 1;
      }
    }
    return { ...counts, changed };
  }

  /* ------------------------------------------------------------------ */
  /* 6. Alertas                                                           */
  /* ------------------------------------------------------------------ */

  async syncAlerts(today: string): Promise<InternalAlert[]> {
    const desired = new Map<string, Partial<InternalAlert>>();
    const since = addDays(today, -180);

    const insts = await this.instRepo.find({
      where: { status: In(['vencida', 'incompleta']) },
      relations: { template: true, project: true, staff: true },
    });
    for (const i of insts) {
      if (i.periodEnd < since) continue;
      if (i.status === 'incompleta' && today <= i.dueDate) continue;
      const k = `act:${i.id}:${i.status}`;
      desired.set(k, {
        dedupeKey: k,
        projectId: i.projectId,
        staffId: i.staffId,
        type: i.status === 'vencida' ? 'actividad_vencida' : 'actividad_incompleta',
        severity: i.status === 'vencida' ? 'alta' : 'media',
        refType: 'activity',
        refId: i.id,
        message: `${i.project?.code}: "${i.template?.name}" (${i.periodKey}) ${i.status === 'vencida' ? 'no se ejecutó' : 'está incompleta'} — límite ${humanDate(i.dueDate)}${i.staff ? ` — ${i.staff.fullName}` : ''}`,
      });
    }

    const ams = await this.amRepo.find({
      where: { status: In(['vencido', 'por_actualizar', 'faltante', 'observado']) },
      relations: { requirement: true, project: true },
    });
    for (const a of ams) {
      const k = `am:${a.id}:${a.status}`;
      const type = { vencido: 'am196_vencido', por_actualizar: 'am196_por_actualizar', faltante: 'am196_faltante', observado: 'am196_observado' }[a.status];
      const sev = a.status === 'vencido' ? 'alta' : a.status === 'faltante' ? 'baja' : 'media';
      const what =
        a.status === 'vencido'
          ? `venció el ${humanDate(a.expiresAt)}`
          : a.status === 'por_actualizar'
            ? `debe actualizarse antes del ${humanDate(a.expiresAt)}`
            : a.status === 'observado'
              ? 'fue observado por la Coordinación SST'
              : 'no tiene evidencia';
      desired.set(k, {
        dedupeKey: k,
        projectId: a.projectId,
        staffId: a.responsibleStaffId,
        type,
        severity: sev,
        refType: 'am196',
        refId: a.id,
        message: `${a.project?.code}: AM 196 ${a.requirement?.code} ${what} — ${a.requirement?.description.slice(0, 90)}`,
      });
    }

    const badLinks = await this.linksRepo.find({ where: { status: 'error' } });
    for (const l of badLinks) {
      const k = `link:${l.id}:error`;
      desired.set(k, {
        dedupeKey: k,
        projectId: l.projectId,
        type: 'onedrive_error',
        severity: 'alta',
        refType: 'drive_link',
        refId: l.id,
        message: `No se pudo leer la carpeta de OneDrive "${l.label || l.folderName || l.sourceUrl}": ${l.lastError || ''}`.slice(0, 400),
      });
    }

    const existing = await this.alertsRepo.find();
    const byKey = new Map(existing.map((e) => [e.dedupeKey, e]));
    const created: InternalAlert[] = [];
    const toSave: InternalAlert[] = [];
    for (const [k, d] of desired) {
      const e = byKey.get(k);
      if (!e) {
        const n = this.alertsRepo.create({ ...d, resolved: false });
        toSave.push(n);
        created.push(n);
      } else if (e.resolved || e.message !== d.message) {
        if (e.resolved) created.push(e);
        Object.assign(e, d, { resolved: false, resolvedAt: null, notified: e.resolved ? false : e.notified });
        toSave.push(e);
      }
    }
    for (const e of existing) {
      if (!e.resolved && !desired.has(e.dedupeKey)) {
        e.resolved = true;
        e.resolvedAt = new Date();
        toSave.push(e);
      }
    }
    for (let i = 0; i < toSave.length; i += 300) await this.alertsRepo.save(toSave.slice(i, i + 300));
    return created;
  }

  /** Envía en un solo correo las alertas abiertas que aún no se han notificado. */
  async sendAlertDigest() {
    if ((await this.settings.get('alertDigest')) !== 'true') return { skipped: 'desactivado' };
    const pending = await this.alertsRepo.find({ where: { resolved: false, notified: false }, order: { createdAt: 'ASC' } });
    // Los requisitos AM 196 sin evidencia se informan en los reportes, no a diario.
    const relevant = pending.filter((a) => a.type !== 'am196_faltante');
    if (!relevant.length) return { sent: false, alerts: 0 };
    const to = await this.settings.recipients();
    if (!to.length) return { sent: false, reason: 'sin destinatarios' };
    const projects = new Map((await this.projectsRepo.find()).map((p) => [p.id, p]));
    const grouped = new Map<string, InternalAlert[]>();
    for (const a of relevant) grouped.set(a.projectId || '-', [...(grouped.get(a.projectId || '-') || []), a]);
    const color: Record<string, string> = { alta: '#b42318', media: '#b54708', baja: '#475467' };
    let html = `<div style="font-family:Arial,sans-serif;color:#16202c"><h2 style="margin:0 0 4px">Alertas nuevas — Documentación Interna ETINAR</h2><p style="color:#475467;margin:0 0 16px">${humanDate(ecToday())} · ${relevant.length} alerta(s)</p>`;
    let text = `Alertas nuevas — Documentación Interna ETINAR (${humanDate(ecToday())})\n\n`;
    for (const [pid, list] of grouped) {
      const p = projects.get(pid);
      html += `<h3 style="margin:16px 0 6px">${p ? `${p.code} — ${p.name}` : 'General'}</h3><ul style="margin:0;padding-left:18px">`;
      text += `${p ? `${p.code} — ${p.name}` : 'General'}\n`;
      for (const a of list.slice(0, 40)) {
        html += `<li style="margin:3px 0"><b style="color:${color[a.severity] || '#475467'}">[${a.severity.toUpperCase()}]</b> ${escapeHtml(a.message)}</li>`;
        text += `  - [${a.severity.toUpperCase()}] ${a.message}\n`;
      }
      if (list.length > 40) html += `<li>… y ${list.length - 40} más (ver el sistema)</li>`;
      html += '</ul>';
    }
    html += `<p style="color:#667085;font-size:12px;margin-top:20px">Generado automáticamente a partir de los registros del sistema y de las carpetas de OneDrive vinculadas.</p></div>`;
    const log = await this.notifications.send({
      to: to.join(','),
      subject: `[SST ETINAR] ${relevant.length} alerta(s) nueva(s) de documentación interna`,
      body: text,
      html,
    });
    if (log.status !== 'error') {
      await this.alertsRepo.update({ id: In(pending.map((a) => a.id)) }, { notified: true });
    }
    return { sent: true, alerts: relevant.length, status: log.status };
  }

  /* ------------------------------------------------------------------ */

  async history(projectId: string | null, targetType: string, targetId: string, action: string, from: string | null, to: string | null, detail: string, actor: string) {
    await this.historyRepo.save(
      this.historyRepo.create({ projectId, targetType, targetId, action, fromStatus: from, toStatus: to, detail, actor }),
    );
  }
}

export function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
