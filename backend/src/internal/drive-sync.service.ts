import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DriveItem, DriveLink, Evidence, TrackingHistory } from './internal.entities';
import { Project } from '../entities/project.entity';
import { GraphError, GraphItem, OneDriveService } from './onedrive.service';
import { norm } from './periods';
import { AuditService } from '../common/audit.service';

/**
 * Vinculación de carpetas de OneDrive/SharePoint por obra y sincronización
 * del índice de metadatos (lectura). No copia el contenido de los archivos.
 */
@Injectable()
export class DriveSyncService {
  private readonly logger = new Logger(DriveSyncService.name);
  private running = new Set<string>();

  constructor(
    @InjectRepository(DriveLink) private linksRepo: Repository<DriveLink>,
    @InjectRepository(DriveItem) private itemsRepo: Repository<DriveItem>,
    @InjectRepository(Evidence) private evidenceRepo: Repository<Evidence>,
    @InjectRepository(TrackingHistory) private historyRepo: Repository<TrackingHistory>,
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    private onedrive: OneDriveService,
    private audit: AuditService,
  ) {}

  async addLink(
    projectId: string,
    body: { url?: string; path?: string; subPath?: string; purpose?: string; label?: string },
    actor: any,
  ) {
    const project = await this.projectsRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Obra no encontrada');
    if (!body.url && !body.path) throw new BadRequestException('Pega el enlace de la carpeta de OneDrive/SharePoint o su ruta');

    const link = this.linksRepo.create({
      projectId,
      purpose: body.purpose || 'general',
      label: body.label?.trim() || null,
      sourceUrl: body.url?.trim() || body.path?.trim() || null,
      subPath: body.subPath?.trim().replace(/^\/+|\/+$/g, '') || null,
      status: 'sin_verificar',
    });

    if (this.onedrive.configured) {
      try {
        const folder = await this.onedrive.resolveTarget({ url: body.url, path: body.path, subPath: body.subPath });
        const dup = await this.linksRepo.findOne({ where: { projectId, driveId: folder.driveId, itemId: folder.id } });
        if (dup) throw new BadRequestException(`Esa carpeta ya está vinculada a la obra (${dup.label || dup.folderName}).`);
        Object.assign(link, {
          driveId: folder.driveId,
          itemId: folder.id,
          folderName: folder.name,
          webUrl: folder.webUrl || null,
          status: 'verificado',
          lastError: null,
        });
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        const msg = err instanceof GraphError ? err.message : String(err);
        throw new BadRequestException(`No se pudo acceder a la carpeta: ${msg}`);
      }
    }

    const saved = await this.linksRepo.save(link);
    await this.audit.log({
      userId: actor?.userId,
      userEmail: actor?.email,
      action: 'INTERNAL_DRIVE_LINK',
      entityType: 'DriveLink',
      entityId: saved.id,
      details: `${project.code}: carpeta "${saved.folderName || saved.sourceUrl}" vinculada (${saved.purpose})`,
    });
    if (saved.status === 'verificado') {
      // Primera lectura en segundo plano: la respuesta no espera el recorrido completo.
      this.scanLink(saved.id).catch((e) => this.logger.error(`Escaneo inicial falló: ${e}`));
    }
    return saved;
  }

  /** Explora un enlace antes de vincularlo: muestra sus subcarpetas (ej. una por obra). */
  async explore(body: { url?: string; path?: string; subPath?: string }) {
    if (!this.onedrive.configured) throw new BadRequestException('Microsoft 365 no está configurado todavía: no se puede explorar OneDrive.');
    try {
      const folder = await this.onedrive.resolveTarget(body);
      const children = await this.onedrive.listChildren(folder.driveId, folder.id);
      return {
        name: folder.name,
        webUrl: folder.webUrl,
        subPath: body.subPath || '',
        folders: children.filter((c) => c.folder).map((c) => ({ name: c.name, childCount: c.folder?.childCount ?? 0 })).sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true })),
        files: children.filter((c) => !c.folder).length,
      };
    } catch (err) {
      throw new BadRequestException(`No se pudo acceder: ${err instanceof GraphError ? err.message : String(err)}`);
    }
  }

  async removeLink(linkId: string, actor: any) {
    const link = await this.linksRepo.findOne({ where: { id: linkId } });
    if (!link) throw new NotFoundException('Vínculo no encontrado');
    // Solo se desvincula en el sistema; en OneDrive no se toca nada.
    await this.itemsRepo.delete({ linkId });
    await this.linksRepo.delete(linkId);
    await this.audit.log({
      userId: actor?.userId,
      userEmail: actor?.email,
      action: 'INTERNAL_DRIVE_UNLINK',
      entityType: 'DriveLink',
      entityId: linkId,
      details: `Carpeta "${link.folderName || link.sourceUrl}" desvinculada (los archivos en OneDrive no se modifican)`,
    });
    return { success: true };
  }

  async scanProject(projectId: string) {
    const links = await this.linksRepo.find({ where: { projectId } });
    const results: any[] = [];
    for (const l of links) results.push(await this.scanLink(l.id));
    return results;
  }

  async scanAll() {
    const links = await this.linksRepo.find();
    let ok = 0;
    let failed = 0;
    let files = 0;
    for (const l of links) {
      const r = await this.scanLink(l.id);
      if (r.ok) {
        ok++;
        files += r.files ?? 0;
      } else failed++;
    }
    return { links: links.length, ok, failed, files };
  }

  /** Lee toda la estructura de la carpeta y actualiza el índice. */
  async scanLink(linkId: string): Promise<{ ok: boolean; files?: number; folders?: number; added?: number; removed?: number; error?: string }> {
    if (this.running.has(linkId)) return { ok: false, error: 'Ya hay una sincronización en curso para esta carpeta' };
    const link = await this.linksRepo.findOne({ where: { id: linkId } });
    if (!link) return { ok: false, error: 'Vínculo no encontrado' };
    if (!this.onedrive.configured) return { ok: false, error: 'Microsoft 365 no configurado' };

    this.running.add(linkId);
    try {
      // Vínculos guardados antes de configurar Azure: se verifican ahora.
      if (!link.driveId || !link.itemId) {
        const isUrl = /^https?:\/\//i.test(link.sourceUrl || '');
        const folder = await this.onedrive.resolveTarget(isUrl ? { url: link.sourceUrl!, subPath: link.subPath } : { path: link.sourceUrl!, subPath: link.subPath });
        Object.assign(link, { driveId: folder.driveId, itemId: folder.id, folderName: folder.name, webUrl: folder.webUrl || null });
      }

      const { items, truncated } = await this.onedrive.walk(link.driveId!, link.itemId!);
      const now = new Date();
      const existing = await this.itemsRepo.find({ where: { linkId } });
      const byItemId = new Map(existing.map((e) => [e.itemId, e]));
      const seen = new Set<string>();
      const toSave: DriveItem[] = [];
      let added = 0;

      for (const w of items) {
        seen.add(w.item.id);
        const row = byItemId.get(w.item.id) || this.itemsRepo.create({ linkId, projectId: link.projectId, firstSeenAt: now });
        if (!row.id) added++;
        const changed =
          !row.id ||
          row.eTag !== (w.item.eTag ?? null) ||
          row.path !== w.relPath ||
          row.removed;
        if (!changed) {
          continue;
        }
        Object.assign(row, this.mapItem(w.item, w.relPath, w.parentId, link.driveId!));
        row.removed = false;
        row.lastSeenAt = now;
        toSave.push(row);
      }

      // Archivos que ya no están en OneDrive: se marcan, no se borran (trazabilidad).
      const gone = existing.filter((e) => !seen.has(e.itemId) && !e.removed);
      if (!truncated) {
        for (const g of gone) {
          g.removed = true;
          g.lastSeenAt = now;
          toSave.push(g);
        }
      }
      for (let i = 0; i < toSave.length; i += 500) await this.itemsRepo.save(toSave.slice(i, i + 500));
      // Marca de "visto" para los que no cambiaron (una sola actualización masiva).
      const unchangedIds = existing.filter((e) => seen.has(e.itemId)).map((e) => e.id);
      for (let i = 0; i < unchangedIds.length; i += 1000) {
        await this.itemsRepo.update({ id: In(unchangedIds.slice(i, i + 1000)) }, { lastSeenAt: now });
      }

      const fileCount = items.filter((i) => !i.item.folder).length;
      link.status = 'verificado';
      link.lastError = truncated ? 'La carpeta supera 25.000 elementos; se indexó parcialmente.' : null;
      link.lastScanAt = now;
      link.itemCount = fileCount;
      await this.linksRepo.save(link);

      if (added || (!truncated && gone.length)) {
        await this.historyRepo.save(
          this.historyRepo.create({
            projectId: link.projectId,
            targetType: 'drive_link',
            targetId: link.id,
            action: 'SINCRONIZACION_ONEDRIVE',
            detail: `${link.folderName}: ${added} elemento(s) nuevo(s), ${truncated ? 0 : gone.length} retirado(s) de OneDrive`,
            actor: 'sistema',
          }),
        );
      }
      return { ok: true, files: fileCount, folders: items.length - fileCount, added, removed: truncated ? 0 : gone.length };
    } catch (err) {
      const msg = err instanceof GraphError ? err.message : String(err);
      link.status = 'error';
      link.lastError = msg.slice(0, 500);
      link.lastScanAt = new Date();
      await this.linksRepo.save(link);
      this.logger.error(`Error sincronizando ${link.folderName || link.sourceUrl}: ${msg}`);
      return { ok: false, error: msg };
    } finally {
      this.running.delete(linkId);
    }
  }

  mapItem(it: GraphItem, relPath: string, parentId: string | null, driveId: string): Partial<DriveItem> {
    return {
      driveId,
      itemId: it.id,
      parentItemId: parentId,
      path: relPath,
      pathNorm: norm(relPath),
      name: it.name,
      isFolder: Boolean(it.folder),
      size: it.size ?? null,
      mimeType: it.file?.mimeType ?? null,
      webUrl: it.webUrl ?? null,
      fileCreatedAt: it.createdDateTime ? new Date(it.createdDateTime) : null,
      fileModifiedAt: it.lastModifiedDateTime ? new Date(it.lastModifiedDateTime) : null,
      createdByName: it.createdBy?.user?.displayName ?? null,
      createdByEmail: it.createdBy?.user?.email ?? null,
      modifiedByName: it.lastModifiedBy?.user?.displayName ?? null,
      modifiedByEmail: it.lastModifiedBy?.user?.email ?? null,
      eTag: it.eTag ?? null,
    };
  }

  /** Registra en el índice un archivo recién subido desde el sistema. */
  async indexUploaded(link: DriveLink, it: GraphItem, relPath: string, parentId: string): Promise<DriveItem> {
    const now = new Date();
    let row = await this.itemsRepo.findOne({ where: { linkId: link.id, itemId: it.id } });
    if (!row) row = this.itemsRepo.create({ linkId: link.id, projectId: link.projectId, firstSeenAt: now });
    Object.assign(row, this.mapItem(it, relPath, parentId, link.driveId!), { removed: false, lastSeenAt: now });
    return this.itemsRepo.save(row);
  }

  /** Contenido de una carpeta (desde el índice) para el explorador. */
  async listFolder(linkId: string, path: string) {
    const link = await this.linksRepo.findOne({ where: { id: linkId } });
    if (!link) throw new NotFoundException('Vínculo no encontrado');
    const clean = (path || '').replace(/^\/+|\/+$/g, '');
    const all = await this.itemsRepo.find({ where: { linkId, removed: false } });
    const prefix = clean ? clean + '/' : '';
    const children = all.filter((i) => i.path.startsWith(prefix) && !i.path.slice(prefix.length).includes('/'));
    // Conteo de archivos por subcarpeta (recursivo)
    const counts = new Map<string, number>();
    for (const i of all) {
      if (i.isFolder || !i.path.startsWith(prefix)) continue;
      const rest = i.path.slice(prefix.length);
      const first = rest.split('/')[0];
      if (rest.includes('/')) counts.set(first, (counts.get(first) || 0) + 1);
    }
    const evid = await this.evidenceRepo.find({ where: { driveItemRowId: In(children.map((c) => c.id).concat(['-'])) } });
    const evCount = new Map<string, number>();
    for (const e of evid) evCount.set(e.driveItemRowId!, (evCount.get(e.driveItemRowId!) || 0) + 1);
    return {
      link,
      path: clean,
      items: children
        .map((c) => ({
          ...c,
          fileCount: c.isFolder ? counts.get(c.name) || 0 : undefined,
          linkedAs: evCount.get(c.id) || 0,
        }))
        .sort((a, b) => Number(b.isFolder) - Number(a.isFolder) || a.name.localeCompare(b.name, 'es', { numeric: true })),
    };
  }

  async listFolders(projectId: string) {
    const items = await this.itemsRepo.find({ where: { projectId, isFolder: true, removed: false }, order: { path: 'ASC' } });
    return items.map((i) => ({ linkId: i.linkId, path: i.path }));
  }

  async searchFiles(projectId: string, q: string) {
    const n = norm(q || '');
    const items = await this.itemsRepo.find({ where: { projectId, isFolder: false, removed: false } });
    return items
      .filter((i) => !n || i.pathNorm.includes(n))
      .sort((a, b) => (b.fileModifiedAt?.getTime() || 0) - (a.fileModifiedAt?.getTime() || 0))
      .slice(0, 100);
  }

  async createFolder(linkId: string, parentPath: string, name: string, actor: any) {
    const link = await this.linksRepo.findOne({ where: { id: linkId } });
    if (!link || !link.driveId || !link.itemId) throw new BadRequestException('Carpeta no verificada en OneDrive');
    const rel = [parentPath, name].filter(Boolean).join('/');
    const id = await this.onedrive.ensureFolder(link.driveId, link.itemId, rel);
    const it = await this.onedrive.getItem(link.driveId, id);
    const parentRow = parentPath
      ? await this.itemsRepo.findOne({ where: { linkId, path: parentPath } })
      : null;
    await this.indexUploaded(link, it, rel, parentRow?.itemId || link.itemId);
    await this.audit.log({
      userId: actor?.userId,
      userEmail: actor?.email,
      action: 'INTERNAL_DRIVE_MKDIR',
      entityType: 'DriveLink',
      entityId: linkId,
      details: `Carpeta creada en OneDrive: ${link.folderName}/${rel}`,
    });
    return { success: true, path: rel };
  }
}
