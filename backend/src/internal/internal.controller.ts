import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { InternalService } from './internal.service';
import { InternalEngineService } from './internal-engine.service';
import { InternalReportsService, ReportType } from './internal-reports.service';
import { InternalSettingsService } from './settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DriveSyncService } from './drive-sync.service';

const INTERNAL = ['admin', 'coordinador_sst', 'director', 'asistente'];
const EDITORS = ['admin', 'coordinador_sst'];

@Controller('internal')
export class InternalCronController {
  constructor(private engine: InternalEngineService) {}

  /**
   * Disparador externo diario (ej. cron-job.org), igual que /api/engine/cron-trigger.
   * Necesario en Render gratuito porque el servidor se duerme y el cron interno
   * no se ejecuta. Lee OneDrive, evalúa, genera alertas y envía los reportes
   * semanal/mensual cuando corresponda (nunca duplica un reporte ya enviado).
   *
   *   POST /api/internal/cron-trigger?secret=TU_CRON_SECRET
   */
  @Post('cron-trigger')
  trigger(@Query('secret') secret: string) {
    const expected = process.env.CRON_SECRET;
    if (!expected || secret !== expected) throw new UnauthorizedException('Clave de disparo inválida o no configurada');
    return this.engine.run({ scan: true, reports: true, source: 'cron-externo' });
  }
}

@Controller('internal')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(...INTERNAL)
export class InternalController {
  constructor(
    private svc: InternalService,
    private engine: InternalEngineService,
    private reports: InternalReportsService,
    private settings: InternalSettingsService,
    private notifications: NotificationsService,
    private driveSync: DriveSyncService,
  ) {}

  /* Estado y motor */
  @Get('status')
  async status() {
    return { ...(await this.svc.status()), mailChannel: this.notifications.channel, settings: await this.settings.all() };
  }

  @Post('run')
  @Roles(...EDITORS)
  run(@Body() body: { scan?: boolean; reports?: boolean }) {
    return this.engine.run({ scan: body?.scan !== false, reports: Boolean(body?.reports), source: 'manual' });
  }

  @Get('dashboard')
  dashboard(@Req() req: any, @Query() q: any) {
    return this.svc.dashboard(req.user, q);
  }

  /* Obras y carpetas */
  @Get('projects')
  projects(@Req() req: any) {
    return this.svc.listProjects(req.user);
  }

  @Get('projects/:id')
  project(@Req() req: any, @Param('id') id: string) {
    return this.svc.projectDetail(req.user, id);
  }

  @Post('projects/:id/links')
  @Roles(...EDITORS)
  addLink(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.addLink(req.user, id, body);
  }

  @Post('drive/explore')
  @Roles(...EDITORS)
  explore(@Body() body: any) {
    return this.driveSync.explore(body);
  }

  @Delete('links/:id')
  @Roles(...EDITORS)
  removeLink(@Req() req: any, @Param('id') id: string) {
    return this.svc.removeLink(req.user, id);
  }

  @Post('links/:id/scan')
  scanLink(@Req() req: any, @Param('id') id: string) {
    return this.svc.scanLink(req.user, id);
  }

  @Post('projects/:id/scan')
  scanProject(@Req() req: any, @Param('id') id: string) {
    return this.svc.scanProject(req.user, id);
  }

  @Get('links/:id/browse')
  browse(@Req() req: any, @Param('id') id: string, @Query('path') path: string) {
    return this.svc.browse(req.user, id, path || '');
  }

  @Post('links/:id/folders')
  @Roles(...EDITORS)
  mkdir(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.createFolder(req.user, id, body);
  }

  @Get('projects/:id/folders')
  folders(@Req() req: any, @Param('id') id: string) {
    return this.svc.folders(req.user, id);
  }

  @Get('projects/:id/files')
  files(@Req() req: any, @Param('id') id: string, @Query('q') q: string) {
    return this.svc.searchFiles(req.user, id, q);
  }

  @Get('drive-items/:id/file')
  async driveFile(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    res.redirect(await this.svc.driveItemDownloadUrl(req.user, id));
  }

  @Get('drive-items/:id/url')
  async driveFileUrl(@Req() req: any, @Param('id') id: string) {
    return { url: await this.svc.driveItemDownloadUrl(req.user, id) };
  }

  /* Personal */
  @Get('staff')
  staff(@Req() req: any) {
    return this.svc.listStaff(req.user);
  }

  @Get('staff/:id')
  staffDetail(@Req() req: any, @Param('id') id: string) {
    return this.svc.staffDetail(req.user, id);
  }

  @Post('staff')
  @Roles(...EDITORS)
  createStaff(@Req() req: any, @Body() body: any) {
    return this.svc.createStaff(req.user, body);
  }

  @Put('staff/:id')
  @Roles(...EDITORS)
  updateStaff(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateStaff(req.user, id, body);
  }

  @Post('staff/:id/access')
  @Roles(...EDITORS)
  access(@Req() req: any, @Param('id') id: string) {
    return this.svc.grantAccess(req.user, id);
  }

  @Post('staff/:id/assignments')
  @Roles(...EDITORS)
  assign(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.assign(req.user, id, body);
  }

  @Delete('assignments/:id')
  @Roles(...EDITORS)
  endAssignment(@Req() req: any, @Param('id') id: string) {
    return this.svc.endAssignment(req.user, id);
  }

  /* Catálogo de actividades */
  @Get('templates')
  templates() {
    return this.svc.listTemplates();
  }

  @Post('templates')
  @Roles(...EDITORS)
  createTemplate(@Req() req: any, @Body() body: any) {
    return this.svc.saveTemplate(req.user, null, body);
  }

  @Put('templates/:id')
  @Roles(...EDITORS)
  updateTemplate(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.saveTemplate(req.user, id, body);
  }

  @Get('projects/:id/activity-config')
  activityConfig(@Req() req: any, @Param('id') id: string) {
    return this.svc.projectActivityConfig(req.user, id);
  }

  @Put('projects/:id/activity-config/:templateId')
  @Roles(...EDITORS)
  saveActivityConfig(@Req() req: any, @Param('id') id: string, @Param('templateId') t: string, @Body() body: any) {
    return this.svc.saveProjectActivityConfig(req.user, id, t, body);
  }

  /* Actividades */
  @Get('activities')
  activities(@Req() req: any, @Query() q: any) {
    return this.svc.listActivities(req.user, q);
  }

  @Get('activities/:id')
  activity(@Req() req: any, @Param('id') id: string) {
    return this.svc.activityDetail(req.user, id);
  }

  @Post('activities/:id/review')
  @Roles(...EDITORS)
  reviewActivity(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.review(req.user, 'activity', id, body);
  }

  @Post('activities/:id/evidence')
  linkActivityEvidence(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.linkEvidence(req.user, 'activity', id, body.driveItemRowId);
  }

  /* AM 196 */
  @Get('am196/requirements')
  requirements() {
    return this.svc.listRequirements();
  }

  @Put('am196/requirements/:id')
  @Roles(...EDITORS)
  saveRequirement(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.saveRequirement(req.user, id, body);
  }

  @Get('am196/matrix')
  matrix(@Req() req: any) {
    return this.svc.am196Matrix(req.user);
  }

  @Get('projects/:id/am196')
  projectAm196(@Req() req: any, @Param('id') id: string) {
    return this.svc.projectAm196(req.user, id);
  }

  @Get('am196/:id')
  am196Detail(@Req() req: any, @Param('id') id: string) {
    return this.svc.am196Detail(req.user, id);
  }

  @Put('am196/:id')
  @Roles(...EDITORS)
  updateAm196(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateAm196Item(req.user, id, body);
  }

  @Post('am196/:id/review')
  @Roles(...EDITORS)
  reviewAm196(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.review(req.user, 'am196', id, body);
  }

  @Post('am196/:id/evidence')
  linkAm196Evidence(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.linkEvidence(req.user, 'am196', id, body.driveItemRowId);
  }

  /* Evidencias */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }))
  upload(@Req() req: any, @UploadedFile() file: Express.Multer.File, @Body() body: any) {
    return this.svc.upload(req.user, file, body);
  }

  @Delete('evidence/:id')
  @Roles(...EDITORS)
  unlink(@Req() req: any, @Param('id') id: string) {
    return this.svc.unlinkEvidence(req.user, id);
  }

  @Get('evidence/:id/file')
  async evidenceFile(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const f = await this.svc.evidenceFile(req.user, id);
    if (f.redirect) return res.redirect(f.redirect);
    res.setHeader('Content-Type', f.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.fileName)}`);
    res.send(f.buffer);
  }

  @Get('evidence/:id/url')
  async evidenceUrl(@Req() req: any, @Param('id') id: string) {
    const f = await this.svc.evidenceFile(req.user, id);
    return { url: f.redirect || null, local: !f.redirect };
  }

  /* Alertas e historial */
  @Get('alerts')
  alerts(@Req() req: any, @Query() q: any) {
    return this.svc.alerts(req.user, q);
  }

  @Get('history')
  history(@Req() req: any, @Query() q: any) {
    return this.svc.history(req.user, q);
  }

  /* Configuración y reportes */
  @Get('settings')
  @Roles(...EDITORS, 'director')
  getSettings() {
    return this.settings.all();
  }

  @Put('settings')
  @Roles(...EDITORS)
  putSettings(@Body() body: Record<string, string>) {
    return this.settings.set(body);
  }

  @Get('reports/history')
  @Roles(...EDITORS, 'director')
  reportHistory() {
    return this.reports.history();
  }

  @Post('reports/send')
  @Roles(...EDITORS)
  sendReport(@Req() req: any, @Body() body: { type: ReportType; key?: string; to?: string }) {
    const type: ReportType = body.type === 'mensual' ? 'mensual' : 'semanal';
    const period = this.reports.periodOf(type, body.key);
    const to = body.to ? body.to.split(/[;,\s]+/).filter(Boolean) : undefined;
    return this.reports.send(type, period, 'manual', req.user.email, to);
  }

  @Get('reports/download')
  @Roles(...EDITORS, 'director')
  async download(@Query('type') type: string, @Query('key') key: string, @Query('format') format: string, @Res() res: Response) {
    const t: ReportType = type === 'mensual' ? 'mensual' : 'semanal';
    const f = (['xlsx', 'pdf', 'html'].includes(format) ? format : 'xlsx') as 'xlsx' | 'pdf' | 'html';
    const { data, period } = await this.reports.download(t, key || undefined, f);
    const mime = { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pdf: 'application/pdf', html: 'text/html; charset=utf-8' }[f];
    res.setHeader('Content-Type', mime);
    if (f !== 'html') res.setHeader('Content-Disposition', `attachment; filename="reporte-${t}-${period.key}.${f}"`);
    res.send(data);
  }
}
