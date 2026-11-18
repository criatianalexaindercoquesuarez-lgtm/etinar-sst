import { Injectable, Logger } from '@nestjs/common';
import { GraphAuthService } from '../sharepoint/graph-auth.service';

/**
 * Acceso a OneDrive / SharePoint a través de Microsoft Graph, con permisos de
 * aplicación autorizados por el administrador de Microsoft 365 de ETINAR.
 *
 * Permisos de aplicación necesarios (Azure AD → App registrations → API permissions):
 *   - Sites.ReadWrite.All   (leer y escribir en las bibliotecas de SharePoint/OneDrive)
 *   - Files.ReadWrite.All   (resolver enlaces compartidos de carpetas)
 *   - Mail.Send             (opcional: enviar los reportes desde un buzón de ETINAR)
 *
 * El sistema NUNCA borra ni sobrescribe archivos en OneDrive: las cargas usan
 * conflictBehavior=rename, y la lectura solo guarda metadatos en el índice.
 */
export interface GraphItem {
  id: string;
  name: string;
  size?: number;
  webUrl?: string;
  eTag?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  folder?: { childCount: number };
  file?: { mimeType?: string };
  parentReference?: { driveId?: string; id?: string; path?: string };
  createdBy?: { user?: { displayName?: string; email?: string } };
  lastModifiedBy?: { user?: { displayName?: string; email?: string } };
}

export interface WalkedItem {
  item: GraphItem;
  relPath: string;
  parentId: string;
}

const SELECT =
  'id,name,size,webUrl,eTag,createdDateTime,lastModifiedDateTime,folder,file,parentReference,createdBy,lastModifiedBy';

export class GraphError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

@Injectable()
export class OneDriveService {
  private readonly logger = new Logger(OneDriveService.name);

  constructor(private graphAuth: GraphAuthService) {}

  get configured(): boolean {
    return this.graphAuth.configured;
  }

  /** Configuración visible en la pantalla de estado (sin secretos). */
  describeConfig() {
    return {
      azureConfigured: this.graphAuth.configured,
      siteConfigured: Boolean(process.env.SHAREPOINT_SITE_ID || process.env.SHAREPOINT_DRIVE_ID),
      mailSender: process.env.MAIL_SENDER || null,
    };
  }

  private async request(path: string, init: RequestInit = {}, attempt = 0): Promise<Response> {
    const token = await this.graphAuth.getAccessToken();
    if (!token) {
      throw new GraphError(
        503,
        'Microsoft 365 no está configurado o no se pudo obtener el token (revisa AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET).',
      );
    }
    const url = path.startsWith('http') ? path : `${this.graphAuth.baseUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    });
    // Limitación de Microsoft Graph: se respeta Retry-After y se reintenta.
    if ((res.status === 429 || res.status === 503 || res.status === 504) && attempt < 4) {
      const wait = Number(res.headers.get('Retry-After')) || 2 ** attempt;
      await new Promise((r) => setTimeout(r, Math.min(wait, 30) * 1000));
      return this.request(path, init, attempt + 1);
    }
    return res;
  }

  private async json<T = any>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.request(path, init);
    if (!res.ok) {
      const body = await res.text();
      let msg = body;
      try {
        msg = JSON.parse(body)?.error?.message || body;
      } catch {
        /* texto plano */
      }
      throw new GraphError(res.status, `Microsoft Graph ${res.status}: ${msg}`.slice(0, 500));
    }
    return (await res.json()) as T;
  }

  /** Convierte un enlace de OneDrive/SharePoint en el identificador de Graph. */
  static encodeShareUrl(url: string): string {
    const b64 = Buffer.from(url.trim(), 'utf8').toString('base64');
    return 'u!' + b64.replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
  }

  /**
   * Resuelve la carpeta a vincular. Acepta:
   *  - Un enlace copiado de OneDrive/SharePoint ("Copiar vínculo" / "Compartir")
   *  - Una ruta dentro de la biblioteca configurada (SHAREPOINT_SITE_ID / SHAREPOINT_DRIVE_ID),
   *    ej. "Obras/OB-2026-01 Puente Daule/SST"
   */
  async resolveFolder(input: { url?: string; path?: string }): Promise<GraphItem & { driveId: string }> {
    let item: GraphItem;
    if (input.url) {
      item = await this.json<GraphItem>(
        `/shares/${OneDriveService.encodeShareUrl(input.url)}/driveItem?$select=${SELECT}`,
      );
    } else if (input.path) {
      const clean = input.path.replace(/^\/+|\/+$/g, '');
      item = await this.json<GraphItem>(
        `${this.libraryRoot()}/root:/${encodeURI(clean)}?$select=${SELECT}`,
      );
    } else {
      throw new GraphError(400, 'Indica el enlace de la carpeta o su ruta en la biblioteca.');
    }
    if (!item.folder) {
      throw new GraphError(400, `"${item.name}" no es una carpeta. Vincula la carpeta de la obra, no un archivo.`);
    }
    const driveId = item.parentReference?.driveId;
    if (!driveId) throw new GraphError(500, 'Graph no devolvió el identificador de la biblioteca (driveId).');
    return { ...item, driveId };
  }

  private libraryRoot(): string {
    if (process.env.SHAREPOINT_DRIVE_ID) return `/drives/${process.env.SHAREPOINT_DRIVE_ID}`;
    if (process.env.SHAREPOINT_SITE_ID) return `/sites/${process.env.SHAREPOINT_SITE_ID}/drive`;
    throw new GraphError(
      400,
      'Para vincular por ruta configura SHAREPOINT_SITE_ID (o SHAREPOINT_DRIVE_ID). También puedes pegar el enlace de la carpeta.',
    );
  }

  /** Subcarpeta por ruta relativa, ej. "OBRA PUENTE DAULE/SST". */
  async getByPath(driveId: string, itemId: string, relPath: string): Promise<GraphItem> {
    const clean = relPath.replace(/^\/+|\/+$/g, '');
    if (!clean) return this.getItem(driveId, itemId);
    const enc = clean.split('/').map(encodeURIComponent).join('/');
    const it = await this.json<GraphItem>(`/drives/${driveId}/items/${itemId}:/${enc}?$select=${SELECT}`);
    if (!it.folder) throw new GraphError(400, `"${clean}" no es una carpeta`);
    return it;
  }

  /**
   * Resuelve la carpeta a vincular: enlace (o ruta de la biblioteca) y, opcionalmente,
   * una subcarpeta dentro de ella. Permite pegar UNA sola vez el enlace de la carpeta
   * general (ej. "DOCUMENTACION DE SEGURIDAD OBRAS ETINAR") y elegir la carpeta de cada obra.
   */
  async resolveTarget(input: { url?: string; path?: string; subPath?: string | null }) {
    const root = await this.resolveFolder({ url: input.url, path: input.path });
    if (!input.subPath) return root;
    const sub = await this.getByPath(root.driveId, root.id, input.subPath);
    return { ...sub, driveId: root.driveId };
  }

  async getItem(driveId: string, itemId: string): Promise<GraphItem> {
    return this.json<GraphItem>(`/drives/${driveId}/items/${itemId}?$select=${SELECT}`);
  }

  async listChildren(driveId: string, itemId: string): Promise<GraphItem[]> {
    const out: GraphItem[] = [];
    let next: string | null = `/drives/${driveId}/items/${itemId}/children?$top=200&$select=${SELECT}`;
    while (next) {
      const page: any = await this.json(next);
      out.push(...(page.value || []));
      next = page['@odata.nextLink'] || null;
    }
    return out;
  }

  /**
   * Recorre toda la estructura de carpetas y subcarpetas (solo metadatos).
   * Se usa recorrido por niveles porque en SharePoint la consulta "delta"
   * solo está disponible en la raíz de la biblioteca, no en subcarpetas.
   */
  async walk(driveId: string, rootId: string, maxItems = 25000): Promise<{ items: WalkedItem[]; truncated: boolean }> {
    const items: WalkedItem[] = [];
    const queue: { id: string; path: string }[] = [{ id: rootId, path: '' }];
    let truncated = false;
    while (queue.length) {
      // Se procesan hasta 4 carpetas en paralelo para no saturar Graph.
      const batch = queue.splice(0, 4);
      const results = await Promise.all(batch.map((f) => this.listChildren(driveId, f.id).then((c) => ({ f, c }))));
      for (const { f, c } of results) {
        for (const child of c) {
          const relPath = f.path ? `${f.path}/${child.name}` : child.name;
          items.push({ item: child, relPath, parentId: f.id });
          if (child.folder) queue.push({ id: child.id, path: relPath });
          if (items.length >= maxItems) {
            truncated = true;
            queue.length = 0;
            break;
          }
        }
        if (truncated) break;
      }
    }
    return { items, truncated };
  }

  /** Devuelve el id de la subcarpeta (la crea si no existe, sin tocar lo existente). */
  async ensureFolder(driveId: string, parentId: string, relPath: string): Promise<string> {
    const segments = relPath.split('/').map((s) => s.trim()).filter(Boolean);
    let current = parentId;
    for (const seg of segments) {
      const res = await this.request(
        `/drives/${driveId}/items/${current}:/${encodeURIComponent(seg)}?$select=id,folder`,
      );
      if (res.ok) {
        const it: any = await res.json();
        current = it.id;
        continue;
      }
      if (res.status !== 404) throw new GraphError(res.status, `No se pudo consultar la carpeta "${seg}"`);
      const created = await this.json<GraphItem>(`/drives/${driveId}/items/${current}/children`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: seg, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }),
      });
      current = created.id;
    }
    return current;
  }

  /**
   * Sube un archivo a una carpeta. Nunca sobrescribe: si existe un archivo
   * con el mismo nombre, OneDrive le asigna un nombre nuevo ("archivo 1.pdf").
   */
  async uploadFile(driveId: string, parentId: string, fileName: string, buffer: Buffer): Promise<GraphItem> {
    const safeName = fileName.replace(/[\\/:*?"<>|#%]/g, '-').trim() || 'archivo';
    if (buffer.length <= 4 * 1024 * 1024) {
      return this.json<GraphItem>(
        `/drives/${driveId}/items/${parentId}:/${encodeURIComponent(safeName)}:/content?@microsoft.graph.conflictBehavior=rename`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: new Uint8Array(buffer),
        },
      );
    }
    // Archivos grandes: sesión de carga por fragmentos (múltiplos de 320 KiB).
    const session: any = await this.json(
      `/drives/${driveId}/items/${parentId}:/${encodeURIComponent(safeName)}:/createUploadSession`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'rename' } }),
      },
    );
    const chunk = 320 * 1024 * 10;
    let last: any = null;
    for (let start = 0; start < buffer.length; start += chunk) {
      const end = Math.min(start + chunk, buffer.length);
      const res = await fetch(session.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': String(end - start),
          'Content-Range': `bytes ${start}-${end - 1}/${buffer.length}`,
        },
        body: new Uint8Array(buffer.subarray(start, end)),
      });
      if (!res.ok && res.status !== 202) {
        throw new GraphError(res.status, `Error en carga por fragmentos: ${await res.text()}`);
      }
      last = await res.json().catch(() => null);
    }
    return last as GraphItem;
  }

  /** URL temporal de descarga (pre-autenticada por Microsoft, válida pocos minutos). */
  async getDownloadUrl(driveId: string, itemId: string): Promise<string> {
    const res = await this.request(`/drives/${driveId}/items/${itemId}/content`, { redirect: 'manual' });
    const loc = res.headers.get('location');
    if (loc) return loc;
    if (res.ok) {
      // Algunos entornos siguen la redirección: se pide la propiedad explícita.
      const it: any = await this.json(`/drives/${driveId}/items/${itemId}?$select=id,@microsoft.graph.downloadUrl`);
      if (it['@microsoft.graph.downloadUrl']) return it['@microsoft.graph.downloadUrl'];
    }
    throw new GraphError(res.status || 404, 'No se pudo obtener el archivo desde OneDrive');
  }

  /** Envía un correo desde un buzón de ETINAR (requiere permiso Mail.Send). */
  async sendMail(params: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    attachments?: { filename: string; content: Buffer; contentType: string }[];
  }) {
    const res = await this.request(`/users/${encodeURIComponent(params.from)}/sendMail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject: params.subject,
          body: { contentType: 'HTML', content: params.html },
          toRecipients: params.to.map((address) => ({ emailAddress: { address } })),
          attachments: (params.attachments || []).map((a) => ({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: a.filename,
            contentType: a.contentType,
            contentBytes: a.content.toString('base64'),
          })),
        },
        saveToSentItems: true,
      }),
    });
    if (!res.ok) throw new GraphError(res.status, `sendMail ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}
