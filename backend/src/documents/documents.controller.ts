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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as mime from 'mime-types';
import { AuthGuard } from '@nestjs/passport';
import { DocumentsService } from './documents.service';
import { DocumentTypesService } from './document-types.service';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { FileStorageService } from '../storage/file-storage.service';
import { AuditService } from '../common/audit.service';

@Controller('documents')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DocumentsController {
  constructor(
    private documentsService: DocumentsService,
    private documentTypesService: DocumentTypesService,
    private fileStorage: FileStorageService,
    private auditService: AuditService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      // En memoria: el archivo va directo al almacenamiento permanente, sin
      // pasar por el disco temporal del servidor.
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File, @Body() body: any, @Req() req: any) {
    return this.documentsService.upload(
      {
        projectId: body.projectId,
        contractorId: body.contractorId,
        folderId: body.folderId,
        documentTypeId: body.documentTypeId,
        dueDate: body.dueDate,
        file,
      },
      req.user,
    );
  }

  @Post(':id/review')
  @Roles('admin', 'coordinador_sst')
  review(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.documentsService.review(id, body.action, body.comments, req.user);
  }

  @Get('project/:projectId')
  byProject(@Param('projectId') projectId: string, @Req() req: any) {
    return this.documentsService.findByProject(projectId, req.user);
  }

  @Get('contractor/:contractorId')
  byContractor(@Param('contractorId') contractorId: string, @Req() req: any) {
    return this.documentsService.findByContractor(contractorId, req.user);
  }

  @Get('pending/review')
  @Roles('admin', 'coordinador_sst')
  pending(@Req() req: any) {
    return this.documentsService.findPendingReview(req.user);
  }

  @Get('alerts/list')
  alerts() {
    return this.documentsService.findAlerts();
  }

  @Post('alerts/run-check')
  @Roles('admin', 'coordinador_sst')
  runCheck() {
    return this.documentsService.runExpirationCheck();
  }

  /**
   * Entrega el archivo ORIGINAL de una versión.
   *   ?download=1 → se descarga (attachment); sin él → se abre en el navegador (inline).
   * Respeta permisos: un contratista solo accede a archivos de su empresa.
   * Si el archivo físico ya no existe responde 410 con un mensaje claro.
   */
  @Get('version/:versionId/file')
  async getFile(
    @Param('versionId') versionId: string,
    @Query('download') download: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const version = await this.documentsService.getVersionForDownload(versionId, req.user);
    const file = await this.fileStorage.get(version);

    if (!file) {
      res.status(410).json({
        statusCode: 410,
        message:
          'El archivo de esta versión ya no está disponible: se cargó antes de activar el almacenamiento ' +
          'permanente y el servidor lo borró al reiniciarse. Solicita al contratista que lo vuelva a cargar ' +
          '(quedará como una nueva versión; el historial se conserva).',
      });
      return;
    }

    const contentType =
      version.contentType || file.contentType || mime.lookup(version.fileName) || 'application/octet-stream';
    const disposition = download === '1' || download === 'true' ? 'attachment' : 'inline';

    await this.auditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      action: disposition === 'attachment' ? 'DOCUMENT_DOWNLOAD' : 'DOCUMENT_VIEW',
      entityType: 'DocumentVersion',
      entityId: version.id,
      details: `${version.fileName} (v${version.versionNumber})`,
    });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', contentDisposition(disposition, version.fileName));
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');

    if (file.buffer) {
      res.setHeader('Content-Length', String(file.buffer.length));
      res.end(file.buffer);
      return;
    }
    if (file.size) res.setHeader('Content-Length', String(file.size));
    file.stream!.on('error', (err) => {
      if (!res.headersSent) res.status(500).json({ message: `Error leyendo el archivo: ${err.message}` });
      else res.destroy(err);
    });
    file.stream!.pipe(res);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.documentsService.findOne(id, req.user);
  }

  @Post('types')
  @Roles('admin', 'coordinador_sst')
  createType(@Body() body: any) {
    return this.documentTypesService.create(body);
  }

  @Put('types/:id')
  @Roles('admin', 'coordinador_sst')
  updateType(@Param('id') id: string, @Body() body: any) {
    return this.documentTypesService.update(id, body);
  }

  @Delete('types/:id')
  @Roles('admin')
  removeType(@Param('id') id: string) {
    return this.documentTypesService.remove(id);
  }

  @Get('types/folder/:folderId')
  typesByFolder(@Param('folderId') folderId: string) {
    return this.documentTypesService.findByFolder(folderId);
  }
}

/**
 * Content-Disposition seguro para nombres con tildes, eñes o comillas.
 * (Antes, un nombre como "Capacitación.pdf" hacía fallar la respuesta.)
 */
function contentDisposition(type: 'inline' | 'attachment', fileName: string): string {
  const ascii = fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
