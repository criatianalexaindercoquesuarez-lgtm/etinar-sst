import { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  FileDown,
  Download,
  Building2,
  HardDrive,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface ReportOption {
  key: string;
  title: string;
  description: string;
  endpoint: string;
  filename: string;
  icon: typeof FileText;
}

const REPORTS: ReportOption[] = [
  {
    key: 'monthly-pdf',
    title: 'Informe Mensual de Gestión (Gerencia)',
    description: 'Resumen ejecutivo del mes en curso: cumplimiento general, por proyecto, ranking de contratistas y sanciones aplicadas. Pensado para enviar a Gerencia y Directores de Obra.',
    endpoint: '/reports/monthly-executive.pdf',
    filename: 'informe-mensual-gestion.pdf',
    icon: Building2,
  },
  {
    key: 'monthly-xlsx',
    title: 'Informe Mensual de Gestión (Excel)',
    description: 'Mismo informe mensual, en Excel con hojas separadas (Resumen, Por Proyecto, Por Contratista, Sanciones) para análisis o carga en Power BI.',
    endpoint: '/reports/monthly-executive.xlsx',
    filename: 'informe-mensual-gestion.xlsx',
    icon: FileSpreadsheet,
  },
  {
    key: 'compliance-pdf',
    title: 'Reporte Ejecutivo de Cumplimiento',
    description: 'Resumen de cumplimiento general y por contratista, listo para imprimir o compartir.',
    endpoint: '/reports/compliance.pdf',
    filename: 'reporte-cumplimiento-etinar.pdf',
    icon: FileText,
  },
  {
    key: 'documents-xlsx',
    title: 'Listado completo de documentos',
    description: 'Todos los documentos del sistema con estado, versiones y fechas, en Excel.',
    endpoint: '/reports/documents.xlsx',
    filename: 'documentos-etinar.xlsx',
    icon: FileSpreadsheet,
  },
  {
    key: 'sanctions-xlsx',
    title: 'Sanciones y multas aplicadas',
    description: 'Historial completo de sanciones aplicadas automáticamente por el motor de cumplimiento.',
    endpoint: '/reports/sanctions.xlsx',
    filename: 'sanciones-etinar.xlsx',
    icon: FileSpreadsheet,
  },
  {
    key: 'audit-csv',
    title: 'Bitácora de auditoría',
    description: 'Registro completo e inmutable de todas las acciones del sistema, en CSV.',
    endpoint: '/reports/audit.csv',
    filename: 'auditoria-etinar.csv',
    icon: FileDown,
  },
];

interface StorageStatus {
  configured: boolean;
  ok: boolean;
  error?: string;
  filesInR2: number;
  filesOnlyLocal: number;
}

function StorageStatusCard() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [requestError, setRequestError] = useState('');

  async function runTest() {
    setLoading(true);
    setRequestError('');
    setStatus(null);
    try {
      const { data } = await api.get('/storage/status');
      setStatus(data);
    } catch (err: any) {
      setRequestError(
        err?.response?.data?.message ||
          'No se pudo consultar el estado. ¿Ya está desplegada la última versión del backend?',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-steel-200 rounded-lg p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <HardDrive size={22} className="text-safety-500 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-steel-900">Estado del almacenamiento de archivos</h3>
            <p className="text-sm text-steel-600 mt-1">
              Comprueba si los documentos que suben los contratistas se están guardando de forma
              permanente en Cloudflare R2. Solo el administrador ve esta tarjeta.
            </p>
          </div>
        </div>
        <button
          onClick={runTest}
          disabled={loading}
          className="shrink-0 bg-steel-900 hover:bg-steel-800 text-white text-sm font-semibold px-4 py-2.5 rounded transition-colors disabled:opacity-60"
        >
          {loading ? 'Probando...' : 'Probar almacenamiento'}
        </button>
      </div>

      {requestError && (
        <p className="mt-4 text-rojo-600 bg-rojo-100 text-sm px-3 py-2 rounded">{requestError}</p>
      )}

      {status && status.ok && (
        <div className="mt-4 bg-verde-100 text-verde-600 rounded px-4 py-3 space-y-1">
          <p className="flex items-center gap-2 font-semibold text-sm">
            <CheckCircle2 size={16} /> R2 funciona correctamente
          </p>
          <p className="text-xs">Archivos respaldados en R2: {status.filesInR2}</p>
          {status.filesOnlyLocal > 0 && (
            <p className="text-xs">
              Archivos que viven solo en el disco temporal del servidor: {status.filesOnlyLocal}.
              Esos se pueden perder; pide a los contratistas que los vuelvan a subir.
            </p>
          )}
        </div>
      )}

      {status && !status.ok && (
        <div className="mt-4 bg-rojo-100 text-rojo-600 rounded px-4 py-3 space-y-2">
          <p className="flex items-center gap-2 font-semibold text-sm">
            <XCircle size={16} />{' '}
            {status.configured ? 'R2 está configurado pero RECHAZA los archivos' : 'R2 no está configurado'}
          </p>
          <p className="text-xs font-semibold">Error exacto (cópialo y envíalo para diagnosticar):</p>
          <p className="text-xs font-mono bg-white/60 rounded px-2 py-1.5 break-words text-steel-900">
            {status.error}
          </p>
          <p className="text-xs">
            Archivos respaldados en R2: {status.filesInR2} · Archivos solo en disco temporal:{' '}
            {status.filesOnlyLocal}
          </p>
        </div>
      )}
    </div>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleDownload(report: ReportOption) {
    setDownloading(report.key);
    setError('');
    try {
      const res = await api.get(report.endpoint, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = report.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(`No se pudo generar "${report.title}". Intenta de nuevo.`);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-black text-steel-900 tracking-tight">
          Reportes
        </h1>
        <p className="text-steel-600 text-sm mt-1">
          Generados en el momento, con los datos reales y actuales del sistema
        </p>
      </header>

      {user?.role === 'admin' && <StorageStatusCard />}

      {error && (
        <p className="text-rojo-600 bg-rojo-100 text-sm px-4 py-2.5 rounded">{error}</p>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {REPORTS.map((r) => (
          <div
            key={r.key}
            className="bg-white border border-steel-200 rounded-lg p-5 flex flex-col"
          >
            <r.icon size={22} className="text-safety-500 mb-3" />
            <h3 className="font-semibold text-steel-900">{r.title}</h3>
            <p className="text-sm text-steel-600 mt-1 flex-1">{r.description}</p>
            <button
              onClick={() => handleDownload(r)}
              disabled={downloading === r.key}
              className="mt-4 flex items-center justify-center gap-2 bg-steel-900 hover:bg-steel-800 text-white text-sm font-semibold py-2.5 rounded transition-colors disabled:opacity-60"
            >
              <Download size={15} />
              {downloading === r.key ? 'Generando...' : 'Descargar'}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white border border-steel-200 rounded-lg p-5">
        <h3 className="font-semibold text-steel-900 mb-2">¿Prefieres un tablero en vivo de Power BI?</h3>
        <p className="text-sm text-steel-600 mb-2">
          Puedes conectar Power BI Desktop directamente a estos datos usando
          "Obtener datos → Web" y pegando la URL correspondiente (necesitas
          añadir tu token de acceso en los encabezados HTTP como
          <code className="bg-steel-50 px-1 rounded mx-1">Authorization: Bearer TU_TOKEN</code>):
        </p>
        <ul className="text-xs font-mono text-steel-500 space-y-1 list-disc list-inside">
          <li>/api/dashboard/summary</li>
          <li>/api/dashboard/by-project</li>
          <li>/api/dashboard/by-contractor</li>
          <li>/api/sanctions</li>
          <li>/api/documents/alerts/list</li>
        </ul>
      </div>
    </div>
  );
}
