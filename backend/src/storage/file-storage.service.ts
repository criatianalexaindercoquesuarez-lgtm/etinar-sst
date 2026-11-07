import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import type { Readable } from 'stream';
import { R2StorageService } from './r2-storage.service';
import { StoredFile } from '../entities/stored-file.entity';
import { DocumentVersion } from '../entities/document-version.entity';

export type StorageProvider = 'r2' | 'db' | 'local';

export interface SaveResult {
  provider: StorageProvider;
  r2Key?: string;
  storedFileId?: string;
}

export interface FileContent {
  contentType?: string;
  size?: number;
  buffer?: Buffer;
  stream?: Readable;
}

/**
 * Punto ÚNICO de almacenamiento de archivos del sistema.
 *
 *  - Si Cloudflare R2 está configurado → se guarda en R2.
 *  - Si no → se guarda en la base de datos (PostgreSQL/Supabase), tabla
 *    stored_files. Es permanente y no requiere credenciales adicionales.
 *
 * Nunca se usa el disco del servidor como almacenamiento definitivo: en
 * Render se borra en cada reinicio, que es lo que causaba que los documentos
 * aparecieran registrados pero no se pudieran ver ni descargar.
 *
 * Toda carga se VERIFICA leyendo de vuelta antes de confirmarse. Si la
 * verificación falla, se lanza un error y no se registra el documento.
 */
@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);

  constructor(
    private r2: R2StorageService,
    @InjectRepository(StoredFile) private storedFilesRepo: Repository<StoredFile>,
  ) {
    this.logger.log(
      `Almacenamiento de archivos activo: ${this.activeProvider === 'r2' ? 'Cloudflare R2' : 'base de datos (PostgreSQL)'}`,
    );
  }

  get activeProvider(): StorageProvider {
    return this.r2.configured ? 'r2' : 'db';
  }

  async save(params: {
    key: string;
    buffer: Buffer;
    contentType: string;
    sha256: string;
  }): Promise<SaveResult> {
    if (this.r2.configured) {
      const result = await this.r2.uploadFile(params.key, params.buffer, params.contentType);
      if (!result.ok) throw new Error(result.error || 'R2 rechazó el archivo');
      return { provider: 'r2', r2Key: params.key };
    }

    const saved = await this.storedFilesRepo.save(
      this.storedFilesRepo.create({
        data: params.buffer,
        contentType: params.contentType,
        sizeBytes: params.buffer.length,
        sha256: params.sha256,
      }),
    );
    // Verificación: se lee de vuelta y se compara el tamaño.
    const check = await this.storedFilesRepo.findOne({ where: { id: saved.id } });
    if (!check || !check.data || Buffer.from(check.data).length !== params.buffer.length) {
      throw new Error('La verificación del archivo guardado en la base de datos falló');
    }
    return { provider: 'db', storedFileId: saved.id };
  }

  /** Recupera el contenido de una versión. Devuelve null si el archivo ya no existe. */
  async get(version: DocumentVersion): Promise<FileContent | null> {
    if (version.storageProvider === 'r2' && version.r2Key) {
      const file = await this.r2.getFileStream(version.r2Key);
      if (file) return { stream: file.stream, contentType: file.contentType };
      return null;
    }

    if (version.storageProvider === 'db' && version.storedFileId) {
      const file = await this.storedFilesRepo.findOne({ where: { id: version.storedFileId } });
      if (!file || !file.data) return null;
      const buffer = Buffer.from(file.data);
      return { buffer, contentType: file.contentType, size: buffer.length };
    }

    // Versiones antiguas (antes de esta corrección): solo en disco local.
    if (version.filePath) {
      const abs = path.resolve(version.filePath);
      if (fs.existsSync(abs)) {
        return { stream: fs.createReadStream(abs), size: fs.statSync(abs).size };
      }
    }
    return null;
  }

  /** ¿Existe físicamente el archivo de esta versión? (sin descargarlo completo) */
  async exists(version: DocumentVersion): Promise<boolean> {
    if (version.storageProvider === 'db' && version.storedFileId) {
      return (await this.storedFilesRepo.count({ where: { id: version.storedFileId } })) > 0;
    }
    if (version.storageProvider === 'r2' && version.r2Key) return true;
    return Boolean(version.filePath && fs.existsSync(path.resolve(version.filePath)));
  }
}
