import { api } from './api';

export interface VersionLike {
  id: string;
  versionNumber: number;
  fileName: string;
  fileAvailable?: boolean;
}

export function latestVersion<T extends { versionNumber: number }>(versions: T[] = []): T | undefined {
  return [...versions].sort((a, b) => b.versionNumber - a.versionNumber)[0];
}

/**
 * Cuando una petición con responseType 'blob' falla, el mensaje del backend
 * viene dentro del blob. Esto lo extrae para mostrar el motivo REAL del error.
 */
export async function fileErrorMessage(err: any): Promise<string> {
  const status = err?.response?.status;
  const data = err?.response?.data;
  let message = '';
  try {
    if (data instanceof Blob) message = JSON.parse(await data.text())?.message || '';
    else message = data?.message || '';
  } catch {
    /* respuesta no JSON */
  }
  if (message) return Array.isArray(message) ? message.join(', ') : message;
  if (status === 403) return 'No tienes permiso para ver este documento.';
  if (status === 404) return 'El documento o la versión no existe.';
  if (!err?.response) return 'No hay conexión con el servidor. Si estuvo inactivo, puede tardar ~1 minuto en despertar; intenta de nuevo.';
  return `No se pudo obtener el archivo (error ${status}).`;
}

export async function fetchVersionFile(versionId: string, download = false): Promise<Blob> {
  const res = await api.get(`/documents/version/${versionId}/file`, {
    params: download ? { download: 1 } : undefined,
    responseType: 'blob',
    timeout: 120000,
  });
  const type = String(res.headers['content-type'] || (res.data as Blob).type || '');
  return new Blob([res.data], { type });
}

export async function downloadVersion(versionId: string, fileName: string): Promise<void> {
  const blob = await fetchVersionFile(versionId, true);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function uploadErrorMessage(err: any): string {
  const status = err?.response?.status;
  const msg = err?.response?.data?.message;
  if (status === 413) return 'El archivo supera el tamaño máximo permitido (20 MB).';
  if (msg) return Array.isArray(msg) ? msg.join(', ') : msg;
  if (!err?.response) return 'No hay conexión con el servidor. Si estuvo inactivo, puede tardar ~1 minuto en despertar; intenta de nuevo.';
  return `No se pudo cargar el documento (error ${status}).`;
}
