import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import {
  ActivityInstance,
  ActivityTemplate,
  Am196Item,
  Am196Requirement,
  DISCIPLINES,
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
import { User, UserRole } from '../entities/user.entity';
import { StoredFile } from '../entities/stored-file.entity';
import { UserProjectsService } from '../user-projects/user-projects.service';
import { AuditService } from '../common/audit.service';
import { OneDriveService, GraphError } from './onedrive.service';
import { DriveSyncService } from './drive-sync.service';
import { InternalEngineService } from './internal-engine.service';
import { addDays, ecToday, periodFor, semaphore } from './periods';

export interface InternalScope {
  /** null = todas las obras */
  projectIds: string[] | null;
  canEdit: boolean;
  staffId: string | null;
  role: string;
}

const FREQS = ['semanal', 'quincenal', 'mensual', 'trimestral', 'semestral', 'anual'];

function stats(list: { status: string; dueDate: string; late?: boolean }[], today: string) {
  const s = { total: list.length, ejecutadas: 0, pendientes: 0, incompletas: 0, vencidas: 0, tarde: 0, noAplica: 0, pct: null as number | null };
  let ev = 0;
  for (const i of list) {
    if (i.status === 'ejecutada') {
      s.ejecutadas++;
      ev++;
      if (i.late) s.tarde++;
    } else if (i.status === 'vencida') {
      s.vencidas++;
      ev++;
    } else if (i.status === 'incompleta') {
      s.incompletas++;
      if (today > i.dueDate) ev++;
    } else if (i.status === 'pendiente') s.pendientes++;
    else s.noAplica++;
  }
  s.pct = ev ? Math.round((s.ejecutadas / ev) * 1000) / 10 : null;
  return s;
}

function amStats(items: { status: string }[]) {
  const c: any = { total: 0, cumple: 0, por_actualizar: 0, vencido: 0, faltante: 0, observado: 0, no_aplica: 0 };
  for (const i of items) {
    c[i.status] = (c[i.status] || 0) + 1;
    if (i.status !== 'no_aplica') c.total++;
  }
  c.pct = c.total ? Math.round(((c.cumple + c.por_actualizar) / c.total) * 1000) / 10 : null;
  return c;
}

@Injectable()
export class InternalService {
  constructor(
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    @InjectRepository(User) private usersRepo: Repository<User>,
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
    private userProjects: UserProjectsService,
    private audit: AuditService,
    private onedrive: OneDriveService,
    private driveSync: DriveSyncService,
    private engine: InternalEngineService,
  ) {}

  /* ------------------------------------------------------------------ */
  /* Alcance por usuario                                                  */
  /* ------------------------------------------------------------------ */

  async scope(user: any): Promise<InternalScope> {
    if (!user || user.role === 'contratista') throw new ForbiddenException('Sin acceso a la documentación interna');
    if (user.role === 'asistente') {
      const staff = await this.staffRepo.findOne({ where: { userId: user.userId } });
      if (!staff) return { projectIds: [], canEdit: false, staffId: null, role: user.role };
      const a = await this.assignRepo.find({ where: { staffId: staff.id, active: true } });
      return { projectIds: a.map((x) => x.projectId), canEdit: false, staffId: staff.id, role: user.role };
    }
    const s = await this.userProjects.resolveScope(user);
    return { projectIds: s.projectIds, canEdit: ['admin', 'coordinador_sst'].includes(user.role), staffId: null, role: user.role };
  }

  private async assertProject(user: any, projectId: string) {
    const sc = await this.scope(user);
    if (sc.projectIds && !sc.projectIds.includes(projectId)) throw new ForbiddenException('No tiene acceso a esta obra');
    return sc;
  }

  private assertEdit(sc: InternalScope) {
    if (!sc.canEdit) throw new ForbiddenException('Solo Administrador o Coordinación SST pueden modificar esta información');
  }

  private async visibleProjectIds(sc: InternalScope): Promise<string[]> {
    const internal = await this.engine.internalProjectIds();
    return sc.projectIds ? internal.filter((p) => sc.projectIds!.includes(p)) : internal;
  }

  /* ------------------------------------------------------------------ */
  /* Estado / configuración                                               */
  /* ------------------------------------------------------------------ */

  async status() {
    const links = await this.linksRepo.find();
    return {
      ...this.onedrive.describeConfig(),
      links: links.length,
      linksOk: links.filter((l) => l.status === 'verificado').length,
      linksError: links.filter((l) => l.status === 'error').length,
      linksUnverified: links.filter((l) => l.status === 'sin_verificar').length,
      lastScanAt: links.map((l) => l.lastScanAt).filter(Boolean).sort().pop() || null,
      pendingUploads: await this.evidenceRepo.count({ where: { syncStatus: 'pendiente_onedrive' } }),
      today: ecToday(),
    };
  }

  /* ------------------------------------------------------------------ */
  /* Obras                                                                */
  /* ------------------------------------------------------------------ */

  async listProjects(user: any) {
    const sc = await this.scope(user);
    const today = ecToday();
    const ids = await this.visibleProjectIds(sc);
    const all = await this.projectsRepo.find({ order: { code: 'ASC' } });
    const projects = all.filter((p) => ids.includes(p.id));
    const monthStart = today.slice(0, 8) + '01';
    const out: any[] = [];
    for (const p of projects) {
      const insts = await this.instRepo.find({ where: { projectId: p.id, periodEnd: Between(addDays(today, -90), addDays(today, 400)) } });
      const ams = await this.amRepo.find({ where: { projectId: p.id } });
      const links = await this.linksRepo.find({ where: { projectId: p.id } });
      const staff = await this.assignRepo.find({ where: { projectId: p.id, active: true }, relations: { staff: true } });
      const monthInsts = insts.filter((i) => i.periodEnd >= monthStart || (i.periodStart <= today && i.periodEnd >= monthStart));
      out.push({
        id: p.id,
        code: p.code,
        name: p.name,
        city: p.city,
        status: p.status,
        staff: staff.map((a) => ({ id: a.staff.id, name: a.staff.fullName, discipline: a.staff.discipline })),
        links: links.map((l) => ({ id: l.id, purpose: l.purpose, label: l.label, folderName: l.folderName, status: l.status, lastScanAt: l.lastScanAt, itemCount: l.itemCount })),
        last90: stats(insts.filter((i) => i.periodEnd <= today || i.status === 'ejecutada'), today),
        month: stats(monthInsts, today),
        am196: amStats(ams),
        alerts: await this.alertsRepo.count({ where: { projectId: p.id, resolved: false } }),
      });
    }
    // Obras sin seguimiento interno aún (para poder vincularlas)
    const available = sc.canEdit ? all.filter((p) => !ids.includes(p.id) && (!sc.projectIds || sc.projectIds.includes(p.id))).map((p) => ({ id: p.id, code: p.code, name: p.name })) : [];
    return { projects: out, available };
  }

  async projectDetail(user: any, projectId: string) {
    const sc = await this.assertProject(user, projectId);
    const p = await this.projectsRepo.findOne({ where: { id: projectId } });
    if (!p) throw new NotFoundException('Obra no encontrada');
    const today = ecToday();
    const links = await this.linksRepo.find({ where: { projectId }, order: { createdAt: 'ASC' } });
    const assigns = await this.assignRepo.find({ where: { projectId }, relations: { staff: true }, order: { createdAt: 'ASC' } });
    const insts = await this.instRepo.find({ where: { projectId } });
    const ams = await this.amRepo.find({ where: { projectId } });
    const fileCount = await this.itemsRepo.count({ where: { projectId, isFolder: false, removed: false } });
    return {
      project: p,
      canEdit: sc.canEdit,
      links,
      assignments: assigns.map((a) => ({
        ...a,
        stats: stats(insts.filter((i) => i.staffId === a.staffId && (i.dueDate < today || i.status === 'ejecutada' || i.periodStart <= today)), today),
      })),
      stats: stats(insts.filter((i) => i.periodStart <= today), today),
      am196: amStats(ams),
      fileCount,
      alerts: await this.alertsRepo.find({ where: { projectId, resolved: false }, order: { createdAt: 'DESC' }, take: 50 }),
    };
  }

  /* ------------------------------------------------------------------ */
  /* Carpetas OneDrive                                                    */
  /* ------------------------------------------------------------------ */

  async addLink(user: any, projectId: string, body: any) {
    const sc = await this.assertProject(user, projectId);
    this.assertEdit(sc);
    const link = await this.driveSync.addLink(projectId, body, user);
    await this.engine.ensureAm196Items();
    return link;
  }

  async removeLink(user: any, linkId: string) {
    const link = await this.linksRepo.findOne({ where: { id: linkId } });
    if (!link) throw new NotFoundException('Vínculo no encontrado');
    const sc = await this.assertProject(user, link.projectId);
    this.assertEdit(sc);
    return this.driveSync.removeLink(linkId, user);
  }

  async scanLink(user: any, linkId: string) {
    const link = await this.linksRepo.findOne({ where: { id: linkId } });
    if (!link) throw new NotFoundException('Vínculo no encontrado');
    await this.assertProject(user, link.projectId);
    const r = await this.driveSync.scanLink(linkId);
    await this.engine.run({ scan: false, projectId: link.projectId, source: 'escaneo' });
    return r;
  }

  async scanProject(user: any, projectId: string) {
    await this.assertProject(user, projectId);
    if (!this.onedrive.configured) throw new BadRequestException('Microsoft 365 no está configurado: no se puede leer OneDrive todavía.');
    const r = await this.driveSync.scanProject(projectId);
    const ev = await this.engine.run({ scan: false, projectId, source: 'escaneo' });
    return { scan: r, evaluation: ev };
  }

  async browse(user: any, linkId: string, path: string) {
    const link = await this.linksRepo.findOne({ where: { id: linkId } });
    if (!link) throw new NotFoundException('Vínculo no encontrado');
    await this.assertProject(user, link.projectId);
    return this.driveSync.listFolder(linkId, path);
  }

  async folders(user: any, projectId: string) {
    await this.assertProject(user, projectId);
    return this.driveSync.listFolders(projectId);
  }

  async searchFiles(user: any, projectId: string, q: string) {
    await this.assertProject(user, projectId);
    return this.driveSync.searchFiles(projectId, q);
  }

  async createFolder(user: any, linkId: string, body: { parentPath?: string; name: string }) {
    const link = await this.linksRepo.findOne({ where: { id: linkId } });
    if (!link) throw new NotFoundException('Vínculo no encontrado');
    const sc = await this.assertProject(user, link.projectId);
    this.assertEdit(sc);
    if (!body.name?.trim()) throw new BadRequestException('Indica el nombre de la carpeta');
    try {
      return await this.driveSync.createFolder(linkId, body.parentPath || '', body.name.trim(), user);
    } catch (e) {
      throw new BadRequestException(e instanceof GraphError ? e.message : String(e));
    }
  }

  async driveItemDownloadUrl(user: any, rowId: string) {
    const row = await this.itemsRepo.findOne({ where: { id: rowId } });
    if (!row) throw new NotFoundException('Archivo no encontrado en el índice');
    await this.assertProject(user, row.projectId);
    if (row.removed) throw new NotFoundException('El archivo ya no existe en OneDrive (retirado)');
    try {
      return await this.onedrive.getDownloadUrl(row.driveId, row.itemId);
    } catch (e) {
      if (row.webUrl) return row.webUrl;
      throw new BadRequestException(e instanceof GraphError ? e.message : String(e));
    }
  }

  /* ------------------------------------------------------------------ */
  /* Personal                                                             */
  /* ------------------------------------------------------------------ */

  async listStaff(user: any) {
    const sc = await this.scope(user);
    const today = ecToday();
    const staff = await this.staffRepo.find({ order: { fullName: 'ASC' } });
    const assigns = await this.assignRepo.find({ relations: { project: true } });
    const insts = await this.instRepo.find({ where: { periodEnd: Between(addDays(today, -90), addDays(today, 400)) } });
    const visible = staff.filter((s) => {
      if (sc.staffId) return s.id === sc.staffId;
      if (!sc.projectIds) return true;
      return assigns.some((a) => a.staffId === s.id && sc.projectIds!.includes(a.projectId));
    });
    return visible.map((s) => {
      const mine = insts.filter((i) => i.staffId === s.id && (i.periodStart <= today));
      const st = stats(mine, today);
      return {
        ...s,
        hasAccess: Boolean(s.userId),
        assignments: assigns
          .filter((a) => a.staffId === s.id)
          .map((a) => ({ id: a.id, projectId: a.projectId, code: a.project?.code, name: a.project?.name, startDate: a.startDate, endDate: a.endDate, active: a.active })),
        stats: st,
        semaforo: semaphore(st.pct),
      };
    });
  }

  async staffDetail(user: any, staffId: string) {
    const sc = await this.scope(user);
    if (sc.staffId && sc.staffId !== staffId) throw new ForbiddenException();
    const s = await this.staffRepo.findOne({ where: { id: staffId } });
    if (!s) throw new NotFoundException('Persona no encontrada');
    const today = ecToday();
    const insts = await this.instRepo.find({ where: { staffId }, relations: { template: true, project: true }, order: { dueDate: 'DESC' }, take: 400 });
    const visible = sc.projectIds ? insts.filter((i) => sc.projectIds!.includes(i.projectId)) : insts;
    const am = await this.amRepo.find({ where: { responsibleStaffId: staffId }, relations: { requirement: true, project: true } });
    return {
      staff: s,
      stats: stats(visible.filter((i) => i.periodStart <= today), today),
      trend: this.trend(visible, today),
      activities: visible.slice(0, 200),
      am196Responsible: amStats(am),
      am196Items: am.filter((a) => a.status !== 'cumple' && a.status !== 'no_aplica').slice(0, 50),
    };
  }

  async createStaff(user: any, body: any) {
    const sc = await this.scope(user);
    this.assertEdit(sc);
    if (!body.fullName?.trim() || !body.email?.trim()) throw new BadRequestException('Nombre y correo son obligatorios');
    if (!DISCIPLINES.includes(body.discipline)) throw new BadRequestException('Rol inválido (sst, ambiente, medico, social)');
    const exists = await this.staffRepo.findOne({ where: { email: body.email.trim().toLowerCase() } });
    if (exists) throw new ConflictException('Ya existe una persona registrada con ese correo');
    const s = await this.staffRepo.save(
      this.staffRepo.create({
        fullName: body.fullName.trim(),
        email: body.email.trim().toLowerCase(),
        discipline: body.discipline,
        jobTitle: body.jobTitle?.trim() || null,
        phone: body.phone?.trim() || null,
      }),
    );
    await this.audit.log({ userId: user.userId, userEmail: user.email, action: 'INTERNAL_STAFF_CREATE', entityType: 'InternalStaff', entityId: s.id, details: `${s.fullName} (${s.discipline})` });
    if (body.projectId) await this.assign(user, s.id, { projectId: body.projectId, startDate: body.startDate });
    return s;
  }

  async updateStaff(user: any, id: string, body: any) {
    const sc = await this.scope(user);
    this.assertEdit(sc);
    const s = await this.staffRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException();
    for (const k of ['fullName', 'jobTitle', 'phone', 'active']) if (k in body) (s as any)[k] = body[k];
    if (body.discipline && DISCIPLINES.includes(body.discipline)) s.discipline = body.discipline;
    if (body.email) s.email = String(body.email).trim().toLowerCase();
    await this.staffRepo.save(s);
    if (s.userId && 'active' in body) await this.usersRepo.update(s.userId, { active: Boolean(body.active) });
    await this.audit.log({ userId: user.userId, userEmail: user.email, action: 'INTERNAL_STAFF_UPDATE', entityType: 'InternalStaff', entityId: s.id, details: JSON.stringify(body).slice(0, 300) });
    return s;
  }

  /** Crea el acceso al sistema (rol "asistente": ve y carga solo lo de sus obras). */
  async grantAccess(user: any, id: string) {
    const sc = await this.scope(user);
    this.assertEdit(sc);
    const s = await this.staffRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException();
    if (s.userId) throw new ConflictException('Esta persona ya tiene acceso');
    const existing = await this.usersRepo.findOne({ where: { email: s.email } });
    if (existing) {
      if (existing.role !== UserRole.ASISTENTE) throw new ConflictException(`Ya existe un usuario con ese correo y rol "${existing.role}".`);
      s.userId = existing.id;
      await this.staffRepo.save(s);
      return { linked: true, email: s.email };
    }
    const words = ['obra', 'faro', 'cima', 'nexo', 'vega', 'ancla'];
    const temporaryPassword = `${words[crypto.randomInt(words.length)]}-${words[crypto.randomInt(words.length)]}-${crypto.randomInt(1000, 9999)}`;
    const u = await this.usersRepo.save(
      this.usersRepo.create({
        email: s.email,
        fullName: s.fullName,
        role: UserRole.ASISTENTE,
        jobTitle: s.jobTitle || undefined,
        password: await bcrypt.hash(temporaryPassword, 10),
      }),
    );
    s.userId = u.id;
    await this.staffRepo.save(s);
    await this.audit.log({ userId: user.userId, userEmail: user.email, action: 'INTERNAL_STAFF_ACCESS', entityType: 'User', entityId: u.id, details: `Acceso creado para ${s.fullName} (${s.email})` });
    return { email: s.email, temporaryPassword };
  }

  async assign(user: any, staffId: string, body: { projectId: string; startDate?: string }) {
    const sc = await this.assertProject(user, body.projectId);
    this.assertEdit(sc);
    const s = await this.staffRepo.findOne({ where: { id: staffId } });
    if (!s) throw new NotFoundException('Persona no encontrada');
    const p = await this.projectsRepo.findOne({ where: { id: body.projectId } });
    if (!p) throw new NotFoundException('Obra no encontrada');
    const dup = await this.assignRepo.findOne({ where: { staffId, projectId: body.projectId, active: true } });
    if (dup) throw new ConflictException('Ya está asignado a esa obra');
    const a = await this.assignRepo.save(
      this.assignRepo.create({ staffId, projectId: body.projectId, startDate: body.startDate || ecToday(), active: true }),
    );
    await this.audit.log({ userId: user.userId, userEmail: user.email, action: 'INTERNAL_STAFF_ASSIGN', entityType: 'StaffAssignment', entityId: a.id, details: `${s.fullName} → ${p.code} desde ${a.startDate}` });
    await this.engine.run({ scan: false, projectId: body.projectId, source: 'asignacion' });
    return a;
  }

  async endAssignment(user: any, id: string) {
    const a = await this.assignRepo.findOne({ where: { id }, relations: { staff: true, project: true } });
    if (!a) throw new NotFoundException();
    const sc = await this.assertProject(user, a.projectId);
    this.assertEdit(sc);
    a.active = false;
    a.endDate = ecToday();
    await this.assignRepo.save(a);
    // Actividades futuras aún sin evidencia quedan sin responsable (se reasignan al nuevo asistente)
    await this.instRepo.update({ staffId: a.staffId, projectId: a.projectId, status: 'pendiente' }, { staffId: null });
    await this.audit.log({ userId: user.userId, userEmail: user.email, action: 'INTERNAL_STAFF_UNASSIGN', entityType: 'StaffAssignment', entityId: a.id, details: `${a.staff.fullName} retirado de ${a.project.code}` });
    return a;
  }

  /* ------------------------------------------------------------------ */
  /* Catálogo de actividades y configuración por obra                     */
  /* ------------------------------------------------------------------ */

  listTemplates() {
    return this.templatesRepo.find({ order: { discipline: 'ASC', sortOrder: 'ASC', code: 'ASC' } });
  }

  async saveTemplate(user: any, id: string | null, body: any) {
    const sc = await this.scope(user);
    this.assertEdit(sc);
    let t = id ? await this.templatesRepo.findOne({ where: { id } }) : this.templatesRepo.create();
    if (!t) throw new NotFoundException();
    if (body.frequency && !FREQS.includes(body.frequency)) throw new BadRequestException('Frecuencia inválida');
    if (body.discipline && !DISCIPLINES.includes(body.discipline)) throw new BadRequestException('Rol inválido');
    for (const k of ['code', 'name', 'description', 'discipline', 'frequency', 'keywords', 'defaultFolder', 'active']) if (k in body) (t as any)[k] = body[k];
    for (const k of ['graceDays', 'minEvidence', 'sortOrder']) if (k in body) (t as any)[k] = Math.max(0, Number(body[k]) || 0);
    if (!t.code || !t.name || !t.discipline || !t.frequency) throw new BadRequestException('Código, nombre, rol y frecuencia son obligatorios');
    t = await this.templatesRepo.save(t);
    // Las fechas límite de períodos aún abiertos se recalculan con el nuevo plazo
    if ('graceDays' in body) {
      const open = await this.instRepo.find({ where: { templateId: t.id, status: In(['pendiente', 'incompleta', 'vencida']) } });
      for (const i of open) i.dueDate = addDays(i.periodEnd, t.graceDays);
      await this.instRepo.save(open);
    }
    await this.audit.log({ userId: user.userId, userEmail: user.email, action: id ? 'INTERNAL_TEMPLATE_UPDATE' : 'INTERNAL_TEMPLATE_CREATE', entityType: 'ActivityTemplate', entityId: t.id, details: `${t.code} ${t.name}` });
    return t;
  }

  async projectActivityConfig(user: any, projectId: string) {
    await this.assertProject(user, projectId);
    const templates = await this.listTemplates();
    const configs = await this.configRepo.find({ where: { projectId } });
    const assigns = await this.assignRepo.find({ where: { projectId, active: true }, relations: { staff: true } });
    const disciplines = new Set(assigns.map((a) => a.staff.discipline));
    return templates
      .filter((t) => t.active)
      .map((t) => ({ template: t, config: configs.find((c) => c.templateId === t.id) || null, staffed: disciplines.has(t.discipline) }));
  }

  async saveProjectActivityConfig(user: any, projectId: string, templateId: string, body: any) {
    const sc = await this.assertProject(user, projectId);
    this.assertEdit(sc);
    let c = await this.configRepo.findOne({ where: { projectId, templateId } });
    if (!c) c = this.configRepo.create({ projectId, templateId, enabled: true });
    for (const k of ['enabled', 'folderPath', 'linkId', 'responsibleStaffId']) if (k in body) (c as any)[k] = body[k] === '' ? null : body[k];
    await this.configRepo.save(c);
    if (body.responsibleStaffId) {
      await this.instRepo.update({ projectId, templateId, status: In(['pendiente', 'incompleta']) }, { staffId: body.responsibleStaffId });
    }
    await this.audit.log({ userId: user.userId, userEmail: user.email, action: 'INTERNAL_ACTIVITY_CONFIG', entityType: 'ProjectActivityConfig', entityId: c.id, details: JSON.stringify(body).slice(0, 300) });
    await this.engine.run({ scan: false, projectId, source: 'configuracion' });
    return c;
  }

  /* ------------------------------------------------------------------ */
  /* Actividades                                                          */
  /* ------------------------------------------------------------------ */

  async listActivities(user: any, q: any) {
    const sc = await this.scope(user);
    const where: any = {};
    if (q.projectId) {
      if (sc.projectIds && !sc.projectIds.includes(q.projectId)) throw new ForbiddenException();
      where.projectId = q.projectId;
    } else if (sc.projectIds) where.projectId = In(sc.projectIds.length ? sc.projectIds : ['-']);
    if (q.staffId) where.staffId = q.staffId;
    if (sc.staffId && q.mine === '1') where.staffId = sc.staffId;
    if (q.status) where.status = In(String(q.status).split(','));
    if (q.templateId) where.templateId = q.templateId;
    const from = q.from || addDays(ecToday(), -35);
    const to = q.to || addDays(ecToday(), 40);
    // Períodos que se cruzan con el rango (incluye anuales/semestrales en curso)
    where.periodStart = LessThanOrEqual(to);
    where.periodEnd = MoreThanOrEqual(from);
    const list = await this.instRepo.find({
      where,
      relations: { template: true, project: true, staff: true },
      order: { dueDate: 'ASC' },
      take: 1000,
    });
    return list.filter((i) => i.periodStart <= ecToday() || i.status !== 'pendiente' || q.includeFuture === '1');
  }

  async activityDetail(user: any, id: string) {
    const i = await this.instRepo.findOne({ where: { id }, relations: { template: true, project: true, staff: true } });
    if (!i) throw new NotFoundException();
    const sc = await this.assertProject(user, i.projectId);
    const cfg = await this.configRepo.findOne({ where: { projectId: i.projectId, templateId: i.templateId } });
    return {
      activity: i,
      config: cfg,
      canEdit: sc.canEdit,
      canUpload: sc.canEdit || (sc.staffId !== null && sc.projectIds?.includes(i.projectId)),
      evidence: await this.evidenceRepo.find({ where: { targetType: 'activity', targetId: id }, order: { createdAt: 'DESC' } }),
      history: await this.historyRepo.find({ where: { targetType: 'activity', targetId: id }, order: { createdAt: 'DESC' } }),
      suggestedFolder: await this.suggestFolder(i.projectId, 'activity', i.templateId, cfg?.folderPath || i.template.defaultFolder),
      links: await this.linksRepo.find({ where: { projectId: i.projectId } }),
    };
  }

  async review(user: any, targetType: 'activity' | 'am196', id: string, body: { action: string; comment?: string }) {
    const repo: Repository<any> = targetType === 'activity' ? this.instRepo : this.amRepo;
    const row: any = await repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException();
    const sc = await this.assertProject(user, row.projectId);
    this.assertEdit(sc);
    const map: Record<string, string | null> = { validar: 'validada', observar: 'observada', no_aplica: 'no_aplica', reabrir: null };
    if (!(body.action in map)) throw new BadRequestException('Acción inválida (validar, observar, no_aplica, reabrir)');
    if (body.action === 'observar' && !body.comment?.trim()) throw new BadRequestException('Indica la observación');
    const prev = row.review;
    row.review = map[body.action];
    row.reviewComment = body.comment?.trim() || null;
    row.reviewedBy = user.email;
    row.reviewedAt = new Date();
    if (targetType === 'am196' && body.action === 'no_aplica') row.applies = false;
    if (targetType === 'am196' && body.action === 'reabrir') row.applies = true;
    await repo.save(row);
    await this.historyRepo.save(
      this.historyRepo.create({
        projectId: row.projectId,
        targetType,
        targetId: id,
        action: `REVISION_${body.action.toUpperCase()}`,
        fromStatus: prev,
        toStatus: row.review,
        detail: body.comment || null,
        actor: user.email,
      }),
    );
    await this.audit.log({ userId: user.userId, userEmail: user.email, action: `INTERNAL_REVIEW_${body.action.toUpperCase()}`, entityType: targetType, entityId: id, details: body.comment || '' });
    await this.engine.run({ scan: false, projectId: row.projectId, source: 'revision' });
    return repo.findOne({ where: { id } });
  }

  /** Vincula manualmente un archivo existente de OneDrive como evidencia. */
  async linkEvidence(user: any, targetType: 'activity' | 'am196', targetId: string, driveItemRowId: string) {
    const row: any = targetType === 'activity' ? await this.instRepo.findOne({ where: { id: targetId } }) : await this.amRepo.findOne({ where: { id: targetId } });
    if (!row) throw new NotFoundException();
    const sc = await this.assertProject(user, row.projectId);
    if (!sc.canEdit && !sc.staffId) throw new ForbiddenException();
    const f = await this.itemsRepo.findOne({ where: { id: driveItemRowId, projectId: row.projectId } });
    if (!f || f.isFolder) throw new BadRequestException('Archivo no encontrado en las carpetas de esta obra');
    const existing = await this.evidenceRepo.findOne({ where: { targetType, targetId, driveItemRowId } });
    if (existing) {
      existing.source = 'manual';
      existing.addedBy = user.email;
      await this.evidenceRepo.save(existing);
    } else {
      await this.evidenceRepo.save(
        this.evidenceRepo.create({
          targetType,
          targetId,
          projectId: row.projectId,
          driveItemRowId,
          fileName: f.name,
          linkId: f.linkId,
          path: f.path,
          webUrl: f.webUrl,
          fileDate: f.fileCreatedAt || f.fileModifiedAt,
          source: 'manual',
          syncStatus: 'sincronizado',
          addedBy: user.email,
        }),
      );
    }
    await this.historyRepo.save(this.historyRepo.create({ projectId: row.projectId, targetType, targetId, action: 'EVIDENCIA_VINCULADA', detail: f.path, actor: user.email }));
    await this.engine.run({ scan: false, projectId: row.projectId, source: 'evidencia' });
    return { ok: true };
  }

  async unlinkEvidence(user: any, evidenceId: string) {
    const ev = await this.evidenceRepo.findOne({ where: { id: evidenceId } });
    if (!ev) throw new NotFoundException();
    const sc = await this.assertProject(user, ev.projectId);
    this.assertEdit(sc);
    if (ev.source === 'auto') throw new BadRequestException('Las evidencias reconocidas automáticamente se ajustan con la carpeta o palabras clave de la actividad');
    if (ev.storedFileId) await this.storedRepo.delete(ev.storedFileId);
    await this.evidenceRepo.delete(ev.id);
    await this.historyRepo.save(this.historyRepo.create({ projectId: ev.projectId, targetType: ev.targetType, targetId: ev.targetId, action: 'EVIDENCIA_DESVINCULADA', detail: `${ev.fileName} (el archivo en OneDrive no se modifica)`, actor: user.email }));
    await this.engine.run({ scan: false, projectId: ev.projectId, source: 'evidencia' });
    return { ok: true };
  }

  async evidenceFile(user: any, evidenceId: string): Promise<{ redirect?: string; buffer?: Buffer; contentType?: string; fileName: string }> {
    const ev = await this.evidenceRepo.findOne({ where: { id: evidenceId } });
    if (!ev) throw new NotFoundException();
    await this.assertProject(user, ev.projectId);
    if (ev.storedFileId) {
      const f = await this.storedRepo.findOne({ where: { id: ev.storedFileId } });
      if (f) return { buffer: Buffer.from(f.data), contentType: f.contentType, fileName: ev.fileName };
    }
    if (ev.driveItemRowId) return { redirect: await this.driveItemDownloadUrl(user, ev.driveItemRowId), fileName: ev.fileName };
    if (ev.webUrl) return { redirect: ev.webUrl, fileName: ev.fileName };
    throw new NotFoundException('Archivo no disponible');
  }

  /** Carpeta sugerida para cargar: donde están las últimas evidencias del mismo tipo. */
  private async suggestFolder(projectId: string, targetType: string, key: string, fallback: string | null) {
    let targets: string[] = [];
    if (targetType === 'activity') targets = (await this.instRepo.find({ where: { projectId, templateId: key }, select: { id: true } })).map((x) => x.id);
    else targets = [key];
    const ev = targets.length
      ? await this.evidenceRepo.find({ where: { projectId, targetType, targetId: In(targets.slice(-200)), syncStatus: 'sincronizado' }, order: { fileDate: 'DESC' }, take: 1 })
      : [];
    if (ev[0]?.path && ev[0].linkId) {
      return { linkId: ev[0].linkId, folderPath: ev[0].path.split('/').slice(0, -1).join('/'), reason: 'Carpeta de las últimas evidencias' };
    }
    return { linkId: null, folderPath: fallback || '', reason: fallback ? 'Carpeta configurada / sugerida' : 'Raíz de la carpeta vinculada' };
  }

  /* ------------------------------------------------------------------ */
  /* Carga desde el sistema → OneDrive                                    */
  /* ------------------------------------------------------------------ */

  async upload(user: any, file: Express.Multer.File, body: { targetType: 'activity' | 'am196'; targetId: string; linkId?: string; folderPath?: string; comment?: string }) {
    if (!file || !file.buffer?.length) throw new BadRequestException('El archivo está vacío');
    if (!['activity', 'am196'].includes(body.targetType)) throw new BadRequestException('Destino inválido');
    const row: any =
      body.targetType === 'activity'
        ? await this.instRepo.findOne({ where: { id: body.targetId }, relations: { template: true } })
        : await this.amRepo.findOne({ where: { id: body.targetId }, relations: { requirement: true } });
    if (!row) throw new NotFoundException('Actividad o requisito no encontrado');
    const sc = await this.assertProject(user, row.projectId);
    if (!sc.canEdit && !sc.staffId) throw new ForbiddenException('No tiene permiso para cargar en esta obra');

    // multer entrega el nombre en latin1
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const links = await this.linksRepo.find({ where: { projectId: row.projectId } });
    const discipline = body.targetType === 'activity' ? row.template.discipline : 'am196';
    const link =
      links.find((l) => l.id === body.linkId) ||
      links.find((l) => l.purpose === discipline) ||
      links.find((l) => body.targetType === 'am196' && l.purpose === 'ministerio') ||
      links.find((l) => l.purpose === 'general') ||
      links[0];
    if (!link) throw new BadRequestException('La obra no tiene carpeta de OneDrive vinculada. Vincúlala primero en la pestaña "Carpetas OneDrive".');
    const folder = (body.folderPath || '').replace(/^\/+|\/+$/g, '');

    const ev = this.evidenceRepo.create({
      targetType: body.targetType,
      targetId: body.targetId,
      projectId: row.projectId,
      fileName,
      linkId: link.id,
      sha256,
      source: 'carga_sistema',
      addedBy: user.email,
      fileDate: new Date(),
    });

    let onedriveError: string | null = null;
    if (this.onedrive.configured && link.driveId && link.itemId) {
      try {
        const parentId = folder ? await this.onedrive.ensureFolder(link.driveId, link.itemId, folder) : link.itemId;
        const it = await this.onedrive.uploadFile(link.driveId, parentId, fileName, file.buffer);
        const rel = folder ? `${folder}/${it.name}` : it.name;
        const idx = await this.driveSync.indexUploaded(link, it, rel, parentId);
        Object.assign(ev, { driveItemRowId: idx.id, path: rel, webUrl: idx.webUrl, fileName: it.name, syncStatus: 'sincronizado' });
      } catch (e) {
        onedriveError = e instanceof GraphError ? e.message : String(e);
      }
    } else {
      onedriveError = 'Microsoft 365 no configurado';
    }

    if (onedriveError) {
      // Respaldo temporal: se guarda en la base de datos y el motor lo sube a OneDrive
      // en cuanto la conexión esté disponible; luego se elimina la copia.
      const stored = await this.storedRepo.save(
        this.storedRepo.create({ data: file.buffer, contentType: file.mimetype || 'application/octet-stream', sizeBytes: file.buffer.length, sha256 }),
      );
      Object.assign(ev, { storedFileId: stored.id, path: folder ? `${folder}/${fileName}` : fileName, syncStatus: 'pendiente_onedrive' });
    }
    const saved = await this.evidenceRepo.save(ev);
    const label = body.targetType === 'activity' ? `${row.template.code} ${row.periodKey}` : row.requirement.code;
    await this.historyRepo.save(
      this.historyRepo.create({
        projectId: row.projectId,
        targetType: body.targetType,
        targetId: body.targetId,
        action: 'EVIDENCIA_CARGADA',
        detail: `${saved.path} (SHA-256 ${sha256.slice(0, 12)}…)${onedriveError ? ' — pendiente de subir a OneDrive' : ''}${body.comment ? ` — ${body.comment}` : ''}`,
        actor: user.email,
      }),
    );
    await this.audit.log({ userId: user.userId, userEmail: user.email, action: 'INTERNAL_EVIDENCE_UPLOAD', entityType: body.targetType, entityId: body.targetId, details: `${label}: ${saved.path} sha256=${sha256}` });
    await this.engine.run({ scan: false, projectId: row.projectId, source: 'carga' });
    return { evidence: saved, onedrive: onedriveError ? { synced: false, reason: onedriveError } : { synced: true } };
  }

  /* ------------------------------------------------------------------ */
  /* AM 196                                                               */
  /* ------------------------------------------------------------------ */

  listRequirements() {
    return this.reqRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async saveRequirement(user: any, id: string, body: any) {
    const sc = await this.scope(user);
    this.assertEdit(sc);
    const r = await this.reqRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException();
    for (const k of ['description', 'legalRef', 'keywords', 'active', 'evidenceType', 'discipline']) if (k in body) (r as any)[k] = body[k];
    if ('validityDays' in body) r.validityDays = body.validityDays === null || body.validityDays === '' ? null : Number(body.validityDays);
    await this.reqRepo.save(r);
    await this.audit.log({ userId: user.userId, userEmail: user.email, action: 'INTERNAL_AM196_REQ_UPDATE', entityType: 'Am196Requirement', entityId: id, details: JSON.stringify(body).slice(0, 300) });
    await this.engine.run({ scan: false, source: 'configuracion' });
    return r;
  }

  async projectAm196(user: any, projectId: string) {
    const sc = await this.assertProject(user, projectId);
    const items = await this.amRepo.find({ where: { projectId }, relations: { requirement: true } });
    items.sort((a, b) => a.requirement.sortOrder - b.requirement.sortOrder);
    const staff = await this.assignRepo.find({ where: { projectId, active: true }, relations: { staff: true } });
    return { canEdit: sc.canEdit, items, stats: amStats(items), staff: staff.map((a) => a.staff), links: await this.linksRepo.find({ where: { projectId } }) };
  }

  async updateAm196Item(user: any, id: string, body: any) {
    const it = await this.amRepo.findOne({ where: { id } });
    if (!it) throw new NotFoundException();
    const sc = await this.assertProject(user, it.projectId);
    this.assertEdit(sc);
    for (const k of ['applies', 'responsibleStaffId', 'responsibleName', 'folderPath', 'linkId', 'notes']) if (k in body) (it as any)[k] = body[k] === '' ? null : body[k];
    await this.amRepo.save(it);
    await this.historyRepo.save(this.historyRepo.create({ projectId: it.projectId, targetType: 'am196', targetId: id, action: 'CONFIGURACION', detail: JSON.stringify(body).slice(0, 300), actor: user.email }));
    await this.engine.run({ scan: false, projectId: it.projectId, source: 'configuracion' });
    return this.amRepo.findOne({ where: { id }, relations: { requirement: true } });
  }

  async am196Detail(user: any, id: string) {
    const it = await this.amRepo.findOne({ where: { id }, relations: { requirement: true, project: true } });
    if (!it) throw new NotFoundException();
    const sc = await this.assertProject(user, it.projectId);
    return {
      item: it,
      canEdit: sc.canEdit,
      canUpload: sc.canEdit || Boolean(sc.staffId),
      evidence: await this.evidenceRepo.find({ where: { targetType: 'am196', targetId: id }, order: { fileDate: 'DESC' } }),
      history: await this.historyRepo.find({ where: { targetType: 'am196', targetId: id }, order: { createdAt: 'DESC' } }),
      suggestedFolder: await this.suggestFolder(it.projectId, 'am196', id, it.folderPath || `AM 196/${it.requirement.code}`),
      links: await this.linksRepo.find({ where: { projectId: it.projectId } }),
      staff: (await this.assignRepo.find({ where: { projectId: it.projectId, active: true }, relations: { staff: true } })).map((a) => a.staff),
    };
  }

  /** Vista consolidada: obras × secciones del Anexo 1. */
  async am196Matrix(user: any) {
    const sc = await this.scope(user);
    const ids = await this.visibleProjectIds(sc);
    const projects = ids.length ? await this.projectsRepo.find({ where: { id: In(ids) }, order: { code: 'ASC' } }) : [];
    const items = ids.length ? await this.amRepo.find({ where: { projectId: In(ids) }, relations: { requirement: true } }) : [];
    const sections = [...new Set(items.map((i) => i.requirement.section))];
    return {
      sections,
      projects: projects.map((p) => {
        const mine = items.filter((i) => i.projectId === p.id);
        return {
          id: p.id,
          code: p.code,
          name: p.name,
          total: amStats(mine),
          bySection: Object.fromEntries(sections.map((s) => [s, amStats(mine.filter((i) => i.requirement.section === s))])),
        };
      }),
    };
  }

  /* ------------------------------------------------------------------ */
  /* Alertas, historial                                                   */
  /* ------------------------------------------------------------------ */

  async alerts(user: any, q: any) {
    const sc = await this.scope(user);
    const where: any = { resolved: q.resolved === '1' };
    if (q.projectId) where.projectId = q.projectId;
    else if (sc.projectIds) where.projectId = In(sc.projectIds.length ? sc.projectIds : ['-']);
    if (sc.staffId) where.staffId = sc.staffId;
    if (q.severity) where.severity = q.severity;
    if (q.type) where.type = In(String(q.type).split(','));
    const list = await this.alertsRepo.find({ where, order: { createdAt: 'DESC' }, take: 500 });
    const projects = new Map((await this.projectsRepo.find()).map((p) => [p.id, p.code]));
    return list.map((a) => ({ ...a, projectCode: a.projectId ? projects.get(a.projectId) : null }));
  }

  async history(user: any, q: any) {
    const sc = await this.scope(user);
    const where: any = {};
    if (q.projectId) where.projectId = q.projectId;
    else if (sc.projectIds) where.projectId = In(sc.projectIds.length ? sc.projectIds : ['-']);
    if (q.targetType) where.targetType = q.targetType;
    if (q.targetId) where.targetId = q.targetId;
    return this.historyRepo.find({ where, order: { createdAt: 'DESC' }, take: Math.min(Number(q.limit) || 200, 1000) });
  }

  /* ------------------------------------------------------------------ */
  /* Dashboard                                                            */
  /* ------------------------------------------------------------------ */

  private trend(insts: ActivityInstance[], today: string) {
    const weeks: { key: string; label: string; pct: number | null; ejecutadas: number; total: number }[] = [];
    for (let k = 11; k >= 0; k--) {
      const p = periodFor('semanal', addDays(today, -7 * k));
      const list = insts.filter((i) => i.periodEnd >= p.start && i.periodEnd <= p.end && i.periodStart <= today);
      const s = stats(list, today);
      weeks.push({ key: p.key, label: `${p.start.slice(8, 10)}/${p.start.slice(5, 7)}`, pct: s.pct, ejecutadas: s.ejecutadas, total: s.total });
    }
    const months: { key: string; label: string; pct: number | null; ejecutadas: number; total: number }[] = [];
    const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    let ref = today.slice(0, 8) + '01';
    const keys: string[] = [];
    for (let k = 0; k < 6; k++) {
      keys.unshift(ref.slice(0, 7));
      ref = addDays(ref, -1).slice(0, 8) + '01';
    }
    for (const key of keys) {
      const p = periodFor('mensual', `${key}-01`);
      const list = insts.filter((i) => i.periodEnd >= p.start && i.periodEnd <= p.end && i.periodStart <= today);
      const s = stats(list, today);
      months.push({ key, label: `${MES[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`, pct: s.pct, ejecutadas: s.ejecutadas, total: s.total });
    }
    return { weeks, months };
  }

  async dashboard(user: any, q: { projectId?: string; discipline?: string }) {
    const sc = await this.scope(user);
    const today = ecToday();
    let ids = await this.visibleProjectIds(sc);
    if (q.projectId) ids = ids.filter((i) => i === q.projectId);
    const projects = ids.length ? await this.projectsRepo.find({ where: { id: In(ids) }, order: { code: 'ASC' } }) : [];
    const since = addDays(today, -200);
    let insts = ids.length
      ? await this.instRepo.find({ where: { projectId: In(ids), periodEnd: Between(since, addDays(today, 400)) }, relations: { template: true } })
      : [];
    if (q.discipline) insts = insts.filter((i) => i.template?.discipline === q.discipline);
    if (sc.staffId) insts = insts.filter((i) => i.staffId === sc.staffId);
    const current = insts.filter((i) => i.periodStart <= today);
    const monthStart = today.slice(0, 8) + '01';
    const monthInsts = current.filter((i) => i.periodEnd >= monthStart);
    const ams = ids.length ? await this.amRepo.find({ where: { projectId: In(ids) }, relations: { requirement: true } }) : [];
    const staff = await this.staffRepo.find();
    const assigns = ids.length ? await this.assignRepo.find({ where: { projectId: In(ids), active: true } }) : [];
    const alerts = ids.length ? await this.alertsRepo.find({ where: { projectId: In(ids), resolved: false }, order: { createdAt: 'DESC' } }) : [];
    const filesTotal = ids.length ? await this.itemsRepo.count({ where: { projectId: In(ids), isFolder: false, removed: false } }) : 0;
    const filesMonth = ids.length
      ? await this.itemsRepo.count({ where: { projectId: In(ids), isFolder: false, removed: false, fileCreatedAt: Between(new Date(`${monthStart}T00:00:00-05:00`), new Date()) } })
      : 0;
    const evidence = ids.length ? await this.evidenceRepo.find({ where: { projectId: In(ids) }, order: { createdAt: 'DESC' }, take: 25 }) : [];
    const codeOf = new Map(projects.map((p) => [p.id, p.code]));
    const last30 = current.filter((i) => i.periodEnd >= addDays(today, -30));

    const staffRows = staff
      .filter((s) => assigns.some((a) => a.staffId === s.id) && (!sc.staffId || s.id === sc.staffId))
      .filter((s) => !q.discipline || s.discipline === q.discipline)
      .map((s) => {
        const mine30 = last30.filter((i) => i.staffId === s.id);
        const mineMonth = monthInsts.filter((i) => i.staffId === s.id);
        const st = stats(mine30, today);
        return {
          id: s.id,
          name: s.fullName,
          discipline: s.discipline,
          projects: assigns.filter((a) => a.staffId === s.id).map((a) => codeOf.get(a.projectId)),
          last30: st,
          month: stats(mineMonth, today),
          semaforo: semaphore(st.pct),
          overdue: current.filter((i) => i.staffId === s.id && (i.status === 'vencida' || (i.status === 'incompleta' && today > i.dueDate))).length,
        };
      })
      .sort((a, b) => (a.last30.pct ?? 101) - (b.last30.pct ?? 101));

    const projRows = projects.map((p) => {
      const mine30 = last30.filter((i) => i.projectId === p.id);
      const st = stats(mine30, today);
      const am = amStats(ams.filter((a) => a.projectId === p.id));
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        last30: st,
        month: stats(monthInsts.filter((i) => i.projectId === p.id), today),
        am196: am,
        semaforo: semaphore(st.pct),
        alerts: alerts.filter((a) => a.projectId === p.id).length,
        staff: assigns.filter((a) => a.projectId === p.id).length,
      };
    });

    const amAll = amStats(ams);
    return {
      today,
      scope: { role: sc.role, canEdit: sc.canEdit, staffId: sc.staffId },
      kpis: {
        obras: projects.length,
        personal: new Set(assigns.map((a) => a.staffId)).size,
        last30: stats(last30, today),
        month: stats(monthInsts, today),
        am196: amAll,
        alertas: alerts.length,
        alertasAltas: alerts.filter((a) => a.severity === 'alta').length,
        archivos: filesTotal,
        archivosMes: filesMonth,
        pendientesAcumulados: current.filter((i) => i.status === 'vencida' || (i.status === 'incompleta' && today > i.dueDate)).length,
      },
      byProject: projRows,
      byStaff: staffRows,
      byDiscipline: DISCIPLINES.map((d) => ({ discipline: d, ...stats(last30.filter((i) => i.template?.discipline === d), today) })).filter((x) => x.total > 0),
      trend: this.trend(insts, today),
      am196BySection: [...new Set(ams.map((a) => a.requirement.section))].map((s) => ({ section: s, ...amStats(ams.filter((a) => a.requirement.section === s)) })),
      alerts: alerts.slice(0, 15).map((a) => ({ ...a, projectCode: a.projectId ? codeOf.get(a.projectId) : null })),
      recentEvidence: evidence.map((e) => ({ ...e, projectCode: codeOf.get(e.projectId) })),
      upcoming: current
        .filter((i) => (i.status === 'pendiente' || i.status === 'incompleta') && i.dueDate >= today)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 12)
        .map((i) => ({ id: i.id, name: i.template?.name, projectCode: codeOf.get(i.projectId), dueDate: i.dueDate, status: i.status })),
    };
  }
}
