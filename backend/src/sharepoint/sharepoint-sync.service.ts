import { Injectable, Logger } from '@nestjs/common';
import { GraphAuthService } from './graph-auth.service';

/**
 * Sincroniza los documentos cargados con SharePoint, manteniendo la
 * estructura organizada exigida:
 *   Proyecto / Contratista / Carpeta documental / Tipo de documento / Año / Mes
 *
 * Crea automáticamente las carpetas cuando no existen (Graph API lo hace
 * implícito al escribir un archivo con "path-based addressing").
 *
 * Variable de entorno adicional requerida:
 *   SHAREPOINT_SITE_ID   — ID del sitio de SharePoint (no la URL).
 *                          Se obtiene con GET /sites/{hostname}:/{site-path}
 *   SHAREPOINT_DRIVE_ID  — (opcional) ID de la biblioteca de documentos;
 *                          si se omite se usa la biblioteca por defecto ("Documents")
 */
@Injectable()
export class SharePointSyncService {
  private readonly logger = new Logger(SharePointSyncService.name);
  readonly configured: boolean;
  private readonly siteId?: string;
  private readonly driveId?: string;

  constructor(private graphAuth: GraphAuthService) {
    this.siteId = process.env.SHAREPOINT_SITE_ID;
    this.driveId = process.env.SHAREPOINT_DRIVE_ID;
    this.configured = graphAuth.configured && Boolean(this.siteId);

    if (!this.configured) {
      this.logger.warn(
        'SharePoint no configurado (falta SHAREPOINT_SITE_ID o credenciales de Azure AD). ' +
          'Los documentos se guardan solo localmente.',
      );
    }
  }

  /**
   * Sube (o reemplaza) el contenido de una versión de documento en SharePoint,
   * respetando la estructura de carpetas exigida. No lanza excepción si falla:
   * registra el error y permite que el flujo de carga local continúe, porque
   * el almacenamiento local ya es la fuente de verdad para el resto del sistema.
   */
  async syncDocumentVersion(params: {
    projectCode: string;
    contractorName: string;
    folderName: string;
    documentTypeName: string;
    fileName: string;
    fileBuffer: Buffer;
  }): Promise<{ synced: boolean; webUrl?: string; error?: string }> {
    if (!this.configured) {
      return { synced: false, error: 'SharePoint no configurado' };
    }

    const token = await this.graphAuth.getAccessToken();
    if (!token) {
      return { synced: false, error: 'No se pudo obtener token de acceso de Azure AD' };
    }

    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');

    const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]/g, '-').trim();
    const path = [
      sanitize(params.projectCode),
      sanitize(params.contractorName),
      sanitize(params.folderName),
      sanitize(params.documentTypeName),
      year,
      month,
      sanitize(params.fileName),
    ].join('/');

    const driveSegment = this.driveId ? `drives/${this.driveId}` : `sites/${this.siteId}/drive`;
    const finalUrl = `https://graph.microsoft.com/v1.0/${driveSegment}/root:/${path}:/content`;

    try {
      const res = await fetch(finalUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
        },
        body: new Uint8Array(params.fileBuffer),
      });

      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`Error subiendo a SharePoint (${res.status}): ${body}`);
        return { synced: false, error: `HTTP ${res.status}` };
      }

      const data: any = await res.json();
      this.logger.log(`Documento sincronizado con SharePoint: ${path}`);
      return { synced: true, webUrl: data.webUrl };
    } catch (err) {
      this.logger.error(`Error de red sincronizando con SharePoint: ${err}`);
      return { synced: false, error: String(err) };
    }
  }
}
