import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { R2StorageService } from './r2-storage.service';
import { FileStorageService } from './file-storage.service';
import { DocumentVersion } from '../entities/document-version.entity';
import { StoredFile } from '../entities/stored-file.entity';

@Controller('storage')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class StorageController {
  constructor(
    private r2Storage: R2StorageService,
    private fileStorage: FileStorageService,
    @InjectRepository(DocumentVersion) private versionsRepo: Repository<DocumentVersion>,
    @InjectRepository(StoredFile) private storedFilesRepo: Repository<StoredFile>,
  ) {}

  /**
   * Estado del almacenamiento permanente: hace una prueba real de escritura y
   * lectura en el proveedor activo y cuenta cuántos archivos están en cada
   * lugar, incluyendo los antiguos que se perdieron del disco temporal.
   */
  @Get('status')
  async status() {
    const provider = this.fileStorage.activeProvider;
    let test: { ok: boolean; error?: string };

    if (provider === 'r2') {
      test = await this.r2Storage.testConnection();
    } else {
      try {
        const buffer = Buffer.from(`Prueba SST ETINAR ${new Date().toISOString()}`);
        const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
        const saved = await this.fileStorage.save({
          key: '_diagnostico',
          buffer,
          contentType: 'text/plain',
          sha256,
        });
        await this.storedFilesRepo.delete({ id: saved.storedFileId });
        test = { ok: true };
      } catch (err: any) {
        test = { ok: false, error: err?.message || String(err) };
      }
    }

    const [filesInR2, filesInDb, legacyLocal] = await Promise.all([
      this.versionsRepo.count({ where: { storageProvider: 'r2' } }),
      this.versionsRepo.count({ where: { storageProvider: 'db' } }),
      this.versionsRepo.find({ where: { storageProvider: 'local' } }),
    ]);

    let legacyMissing = 0;
    for (const v of legacyLocal) {
      if (!(await this.fileStorage.exists(v))) legacyMissing++;
    }

    return {
      provider,
      configured: true,
      r2Configured: this.r2Storage.configured,
      ok: test.ok,
      error: test.error,
      filesInR2,
      filesInDb,
      filesOnlyLocal: legacyLocal.length,
      filesMissing: legacyMissing,
    };
  }
}
