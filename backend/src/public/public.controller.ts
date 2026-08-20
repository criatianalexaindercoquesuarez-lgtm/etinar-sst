import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { PublicUploadService } from './public-upload.service';

/**
 * Endpoints deliberadamente SIN AuthGuard: el token largo en la URL es el
 * único mecanismo de seguridad, tal como corresponde a un "enlace
 * personalizado" de recepción documental sin necesidad de cuenta.
 */
@Controller('public/upload-link')
export class PublicController {
  constructor(private publicUploadService: PublicUploadService) {}

  @Get(':token')
  getContext(@Param('token') token: string) {
    return this.publicUploadService.getUploadContext(token);
  }

  @Post(':token/upload')
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
  upload(
    @Param('token') token: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    return this.publicUploadService.uploadViaToken(
      token,
      {
        projectId: body.projectId,
        folderId: body.folderId,
        documentTypeId: body.documentTypeId,
        dueDate: body.dueDate,
        file,
      },
      body.uploaderName,
    );
  }
}
