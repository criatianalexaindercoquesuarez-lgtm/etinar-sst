import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import type { Readable } from 'stream';

/**
 * Almacenamiento permanente de archivos en Cloudflare R2 (compatible con
 * la API de S3). Reemplaza el disco local, que en Render (plan gratuito)
 * se borra cada vez que el servicio se reinicia o redespliega.
 *
 * Requiere estas variables de entorno (backend/.env o Render):
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *
 * Sin estas variables, el sistema sigue funcionando pero guarda los
 * archivos solo en disco local (con el riesgo de pérdida ya conocido).
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
          'disco local, que SE BORRA en cada redespliegue.',
      );
    }
  }

  async uploadFile(key: string, buffer: Buffer, contentType: string): Promise<boolean> {
    if (!this.configured || !this.client) return false;
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
      return true;
    } catch (err) {
      this.logger.error(`Error subiendo archivo a R2 (${key}): ${err}`);
      return false;
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
      this.logger.error(`Error descargando archivo de R2 (${key}): ${err}`);
      return null;
    }
  }
}
