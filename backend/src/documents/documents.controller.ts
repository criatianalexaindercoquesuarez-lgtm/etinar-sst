import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as mime from 'mime-types';
import { AuthGuard } from '@nestjs/passport';
import { DocumentsService } from './documents.service';
import { DocumentTypesService } from './document-types.service';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { R2StorageService } from '../storage/r2-storage.service';

@Controller('documents')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DocumentsController {
  constructor(
    private documentsService: DocumentsService,
    private documentTypesService: DocumentTypesService,
    private r2Storage: R2StorageService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './src/uploads',
        filename: (req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
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
   * Sirve el archivo desde Cloudflare R2 (permanente) si la versión se
   * guardó ahí; si no, cae al disco local (con el riesgo conocido de que
   * pueda ya no existir tras un redespliegue).
   */
  @Get('version/:versionId/file')
  async getFile(@Param('versionId') versionId: string, @Req() req: any, @Res() res: Response) {
    const version = await this.documentsService.getVersionForDownload(versionId, req.user);
    const contentType = mime.lookup(version.fileName) || 'application/octet-stream';

    if (version.storageProvider === 'r2' && version.r2Key) {
      const file = await this.r2Storage.getFileStream(version.r2Key);
      if (file) {
        res.setHeader('Content-Type', file.contentType || contentType);
        res.setHeader('Content-Disposition', `inline; filename="${version.fileName}"`);
        file.stream.pipe(res);
        return;
      }
      // Si por algún motivo R2 falla al leer, se intenta el respaldo local.
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${version.fileName}"`);
    res.sendFile(version.filePath, { root: '.' }, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({
          message:
            'El archivo ya no está disponible (se guardó solo en disco temporal antes de activar el almacenamiento permanente).',
        });
      }
    });
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
