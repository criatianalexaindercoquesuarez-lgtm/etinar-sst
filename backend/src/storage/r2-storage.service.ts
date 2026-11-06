import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import type { Readable } from 'stream';

export interface R2UploadResult {
  ok: boolean;
  error?: string;
}

export interface R2TestResult {
  configured: boolean;
  ok: boolean;
  error?: string;
}

/**
 * Almacenamiento permanente de archivos en Cloudflare R2 (compatible con
 * la API de S3). Reemplaza el disco local, que en Render (plan gratuito)
 * se borra cuando el servidor se reinicia o se duerme.
 *
 * Variables de entorno requeridas:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 */
@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private client: S3Client | null = null;
  readonly configured: boolean;
  private readonly bucket?: string;

  constructor() {
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } =
      process.env;
    this.configured = Boolean(
      R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME,
    );
    this.bucket = R2_BUCKET_NAME;

    if (this.configured) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: R2_ACCESS_KEY_ID!,
          secretAccessKey: R2_SECRET_ACCESS_KEY!,
        },
      });
      this.logger.log('Cloudflare R2 configurado — los archivos se guardan de forma permanente.');
    } else {
      this.logger.warn(
        'Cloudflare R2 no configurado (faltan R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/' +
          'R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME). Los archivos se guardan solo en ' +
          'disco local, que SE BORRA cuando el servidor se reinicia o se duerme.',
      );
    }
  }

  private describeError(err: any): string {
    const name = err?.name || err?.Code || 'Error';
    const message = err?.message || String(err);
    return `${name}: ${message}`;
  }

  async uploadFile(key: string, buffer: Buffer, contentType: string): Promise<R2UploadResult> {
    if (!this.configured || !this.client) {
      return { ok: false, error: 'R2 no está configurado' };
    }
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
      return { ok: true };
    } catch (err) {
      const error = this.describeError(err);
      this.logger.error(`Error subiendo archivo a R2 (${key}): ${error}`);
      return { ok: false, error };
    }
  }

  async getFileStream(key: string): Promise<{ stream: Readable; contentType?: string } | null> {
    if (!this.configured || !this.client) return null;
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        stream: result.Body as Readable,
        contentType: result.ContentType,
      };
    } catch (err) {
      this.logger.error(`Error descargando archivo de R2 (${key}): ${this.describeError(err)}`);
      return null;
    }
  }

  /**
   * Prueba real de extremo a extremo: escribe un archivo pequeño, lo lee
   * de vuelta y lo borra. Devuelve el error exacto si algo falla.
   */
  async testConnection(): Promise<R2TestResult> {
    if (!this.configured || !this.client) {
      return {
        configured: false,
        ok: false,
        error:
          'Faltan variables de entorno de R2 en Render (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, ' +
          'R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).',
      };
    }

    const key = `_diagnostico/prueba-${Date.now()}.txt`;
    const content = `Prueba de almacenamiento SST ETINAR ${new Date().toISOString()}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: Buffer.from(content),
          ContentType: 'text/plain',
        }),
      );

      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const readBack = await (result.Body as any).transformToString();
      if (readBack !== content) {
        return { configured: true, ok: false, error: 'El archivo leído no coincide con el escrito.' };
      }

      try {
        await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      } catch {
        // si no se puede borrar la prueba, no es un error del almacenamiento
      }

      return { configured: true, ok: true };
    } catch (err) {
      const error = this.describeError(err);
      this.logger.error(`Prueba de conexión a R2 falló: ${error}`);
      return { configured: true, ok: false, error };
    }
  }
}
