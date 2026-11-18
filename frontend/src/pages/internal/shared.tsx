import { useState, type ReactNode } from 'react';
import { X, ExternalLink, Download, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

export const DISCIPLINE_LABELS: Record<string, string> = {
  sst: 'Asistente SST',
  ambiente: 'Asistente Ambiental',
  medico: 'Médico / Asist. médico',
  social: 'Gestión Social',
};
export const DISCIPLINE_SHORT: Record<string, string> = { sst: 'SST', ambiente: 'Ambiente', medico: 'Médico', social: 'Social' };

export const FREQ_LABELS: Record<string, string> = {
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
};

export const PURPOSE_LABELS: Record<string, string> = {
  general: 'Carpeta general de la obra',
  sst: 'Seguridad y Salud (SST)',
  ambiente: 'Ambiente',
  medico: 'Médico',
  social: 'Social',
  am196: 'AM 196',
  ministerio: 'Ministerio del Trabajo',
};

const ACT_STYLE: Record<string, [string, string]> = {
  ejecutada: ['bg-verde-100 text-verde-600', 'Ejecutada'],
  pendiente: ['bg-steel-200 text-steel-700', 'Pendiente'],
  incompleta: ['bg-amarillo-100 text-amarillo-600', 'Incompleta'],
  vencida: ['bg-rojo-100 text-rojo-600', 'No ejecutada'],
  no_aplica: ['bg-steel-200 text-steel-600', 'No aplica'],
};
const AM_STYLE: Record<string, [string, string]> = {
  cumple: ['bg-verde-100 text-verde-600', 'Cumple'],
  por_actualizar: ['bg-amarillo-100 text-amarillo-600', 'Por actualizar'],
  vencido: ['bg-rojo-100 text-rojo-600', 'Vencido'],
  faltante: ['bg-steel-200 text-steel-700', 'Faltante'],
  observado: ['bg-safety-100 text-safety-600', 'Observado'],
  no_aplica: ['bg-steel-200 text-steel-600', 'No aplica'],
};

export function ActStatus({ status, late }: { status: string; late?: boolean }) {
  const [cls, label] = ACT_STYLE[status] || ['bg-steel-200 text-steel-700', status];
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{label}</span>
      {late && <span className="text-[10px] font-semibold text-amarillo-600">fuera de plazo</span>}
    </span>
  );
}

export function AmStatus({ status }: { status: string }) {
  const [cls, label] = AM_STYLE[status] || ['bg-steel-200 text-steel-700', status];
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{label}</span>;
}

export function semaphore(pct: number | null | undefined) {
  if (pct === null || pct === undefined) return 'gris';
  if (pct >= 90) return 'verde';
  if (pct >= 70) return 'amarillo';
  return 'rojo';
}
const SEM_BG: Record<string, string> = { verde: 'bg-verde-600', amarillo: 'bg-amarillo-600', rojo: 'bg-rojo-600', gris: 'bg-steel-400' };
const SEM_TEXT: Record<string, string> = { verde: 'text-verde-600', amarillo: 'text-amarillo-600', rojo: 'text-rojo-600', gris: 'text-steel-400' };

export function Pct({ value, size = 'sm' }: { value: number | null | undefined; size?: 'sm' | 'lg' }) {
  const s = semaphore(value);
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold ${size === 'lg' ? 'text-2xl font-display font-black' : 'text-sm'} ${SEM_TEXT[s]}`}>
      <span className={`inline-block rounded-full ${SEM_BG[s]} ${size === 'lg' ? 'w-3 h-3' : 'w-2 h-2'}`} />
      {value === null || value === undefined ? '—' : `${value}%`}
    </span>
  );
}

export function Bar({ value }: { value: number | null | undefined }) {
  const s = semaphore(value);
  return (
    <div className="h-1.5 bg-steel-100 rounded-full overflow-hidden w-full">
      <div className={`h-full ${SEM_BG[s]}`} style={{ width: `${value ?? 0}%` }} />
    </div>
  );
}

export function fmtDate(s?: string | null) {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
export function fmtDateTime(s?: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleString('es-EC', { timeZone: 'America/Guayaquil', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'alert' | 'ok' }) {
  return (
    <div className="bg-white border border-steel-200 rounded-lg p-4">
      <div className={`font-display text-3xl font-black ${tone === 'alert' ? 'text-safety-500' : tone === 'ok' ? 'text-verde-600' : 'text-steel-900'}`}>{value}</div>
      <div className="text-steel-600 text-sm mt-1">{label}</div>
      {sub && <div className="text-steel-400 text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-white border border-steel-200 rounded-lg ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          <h2 className="font-semibold text-steel-900">{title}</h2>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

export function Drawer({ title, subtitle, onClose, children, wide }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-steel-950/40" onClick={onClose}>
      <div className={`h-full bg-white shadow-xl overflow-y-auto w-full ${wide ? 'max-w-3xl' : 'max-w-2xl'}`} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-steel-200 px-6 py-4 flex items-start justify-between gap-4 z-10">
          <div className="min-w-0">
            <div className="font-display text-xl font-black text-steel-900 leading-tight">{title}</div>
            {subtitle && <div className="text-sm text-steel-600 mt-1">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-steel-100 text-steel-600" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-6">{children}</div>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-steel-950/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-steel-200">
          <h3 className="font-semibold text-steel-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-steel-100" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export const inputBase = 'border border-steel-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-safety-400 bg-white';
export const inputCls = `w-full ${inputBase}`;
export const btnPrimary = 'inline-flex items-center gap-2 bg-safety-500 hover:bg-safety-600 text-white text-sm font-semibold px-4 py-2 rounded disabled:opacity-50';
export const btnSecondary = 'inline-flex items-center gap-2 border border-steel-200 hover:bg-steel-50 text-steel-700 text-sm font-medium px-3 py-2 rounded disabled:opacity-50';
export const btnGhost = 'inline-flex items-center gap-1.5 text-sm text-steel-600 hover:text-steel-900 px-2 py-1 rounded hover:bg-steel-100';

export function errMsg(e: any): string {
  const m = e?.response?.data?.message;
  if (Array.isArray(m)) return m.join(', ');
  return m || e?.message || 'Error inesperado';
}

/** Abre un archivo de evidencia: OneDrive (enlace temporal) o copia temporal del sistema. */
export async function openEvidence(id: string) {
  const { data } = await api.get(`/internal/evidence/${id}/url`);
  if (data.url) {
    window.open(data.url, '_blank', 'noopener');
    return;
  }
  const res = await api.get(`/internal/evidence/${id}/file`, { responseType: 'blob' });
  window.open(URL.createObjectURL(res.data), '_blank', 'noopener');
}

export async function openDriveItem(rowId: string) {
  const { data } = await api.get(`/internal/drive-items/${rowId}/url`);
  window.open(data.url, '_blank', 'noopener');
}

export function EvidenceButtons({ id, webUrl }: { id: string; webUrl?: string | null }) {
  const [busy, setBusy] = useState(false);
  return (
    <span className="inline-flex items-center gap-1">
      <button
        className={btnGhost}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await openEvidence(id);
          } catch (e) {
            alert(errMsg(e));
          } finally {
            setBusy(false);
          }
        }}
        title="Ver / descargar"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      </button>
      {webUrl && (
        <a className={btnGhost} href={webUrl} target="_blank" rel="noopener noreferrer" title="Abrir en OneDrive / SharePoint">
          <ExternalLink size={14} />
        </a>
      )}
    </span>
  );
}

export async function downloadBlob(url: string, params: Record<string, string>, fallbackName: string) {
  const res = await api.get(url, { params, responseType: 'blob' });
  const cd = res.headers['content-disposition'] || '';
  const name = /filename="?([^";]+)"?/.exec(cd)?.[1] || fallbackName;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(res.data);
  a.download = name;
  a.click();
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="text-sm text-steel-400 text-center py-8">{children}</div>;
}
