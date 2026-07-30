import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
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

@Controller('documents')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DocumentsController {
  constructor(
    private documentsService: DocumentsService,
    private documentTypesService: DocumentTypesService,
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
      limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Req() req: any,
  ) {
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
  byProject(@Param('projectId') projectId: string) {
    return this.documentsService.findByProject(projectId);
  }

  @Get('contractor/:contractorId')
  byContractor(@Param('contractorId') contractorId: string) {
    return this.documentsService.findByContractor(contractorId);
  }

  @Get('pending/review')
  @Roles('admin', 'coordinador_sst')
  pending() {
    return this.documentsService.findPendingReview();
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

  @Get('version/:versionId/file')
  async getFile(
    @Param('versionId') versionId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const version = await this.documentsService.getVersionForDownload(versionId, req.user);
    const contentType = mime.lookup(version.fileName) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${version.fileName}"`);
    res.sendFile(version.filePath, { root: '.' });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Post('types')
  @Roles('admin', 'coordinador_sst')
  createType(@Body() body: any) {
    return this.documentTypesService.create(body);
  }

  @Get('types/folder/:folderId')
  typesByFolder(@Param('folderId') folderId: string) {
    return this.documentTypesService.findByFolder(folderId);
  }
}
