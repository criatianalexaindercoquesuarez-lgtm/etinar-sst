import { useState } from 'react';
import { FileText, FileSpreadsheet, FileDown, Download } from 'lucide-react';
import { api } from '../lib/api';

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

export default function Reports() {
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
    </div>
  );
}
