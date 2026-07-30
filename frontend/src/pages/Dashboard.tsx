import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Semaphore } from '../components/Badges';

interface Summary {
  projects: { total: number; active: number };
  contractors: { total: number; active: number; suspended: number; blocked: number };
  workers: { total: number; blocked: number; enabled: number };
  documents: {
    total: number;
    approved: number;
    pending: number;
    observed: number;
    rejected: number;
    porVencer: number;
    vencido: number;
  };
  complianceRate: number;
  unresolvedAlerts: number;
  finesCount: number;
  semaphore: string;
}

interface ByContractor {
  contractorId: string;
  name: string;
  status: string;
  totalDocuments: number;
  approvedDocuments: number;
  complianceRate: number;
  semaphore: string;
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [byContractor, setByContractor] = useState<ByContractor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/summary'),
      api.get('/dashboard/by-contractor'),
    ]).then(([s, c]) => {
      setSummary(s.data);
      setByContractor(c.data);
      setLoading(false);
    });
  }, []);

  if (loading || !summary) {
    return <p className="text-steel-400">Cargando indicadores...</p>;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-black text-steel-900 tracking-tight">
          Dashboard Ejecutivo
        </h1>
        <p className="text-steel-600 text-sm mt-1">
          Indicadores calculados automáticamente en tiempo real
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Proyectos activos" value={summary.projects.active} sub={`${summary.projects.total} totales`} />
        <KpiCard label="Contratistas activos" value={summary.contractors.active} sub={`${summary.contractors.suspended} suspendidos`} />
        <KpiCard label="Empresas bloqueadas" value={summary.contractors.blocked} accent={summary.contractors.blocked > 0} />
        <KpiCard label="Trabajadores habilitados" value={summary.workers.enabled} sub={`${summary.workers.blocked} bloqueados`} />
        <KpiCard label="Documentos por vencer" value={summary.documents.porVencer} accent={summary.documents.porVencer > 0} />
        <KpiCard label="Documentos vencidos" value={summary.documents.vencido} accent={summary.documents.vencido > 0} />
        <KpiCard label="Multas generadas" value={summary.finesCount} />
        <KpiCard label="Alertas sin resolver" value={summary.unresolvedAlerts} accent={summary.unresolvedAlerts > 0} />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-white border border-steel-200 rounded-lg p-6 flex flex-col items-center justify-center text-center">
          <Semaphore color={summary.semaphore} />
          <div className="font-display text-5xl font-black text-steel-900 mt-3">
            {summary.complianceRate}%
          </div>
          <p className="text-steel-600 text-sm mt-1">Cumplimiento documental general</p>
        </div>

        <div className="md:col-span-2 bg-white border border-steel-200 rounded-lg p-6">
          <h2 className="font-semibold text-steel-900 mb-4">Estado de documentos</h2>
          <div className="space-y-3">
            <DocBar label="Aprobados" value={summary.documents.approved} total={summary.documents.total} color="bg-verde-600" />
            <DocBar label="Por vencer" value={summary.documents.porVencer} total={summary.documents.total} color="bg-amarillo-600" />
            <DocBar label="Vencidos" value={summary.documents.vencido} total={summary.documents.total} color="bg-rojo-600" />
            <DocBar label="Pendientes" value={summary.documents.pending} total={summary.documents.total} color="bg-steel-400" />
            <DocBar label="Observados" value={summary.documents.observed} total={summary.documents.total} color="bg-safety-500" />
            <DocBar label="Rechazados" value={summary.documents.rejected} total={summary.documents.total} color="bg-rojo-600" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-steel-200 rounded-lg overflow-hidden">
        <h2 className="font-semibold text-steel-900 px-6 pt-6 pb-4">
          Ranking de cumplimiento por contratista
        </h2>
        <table className="w-full text-sm">
          <thead className="bg-steel-50 text-steel-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-6 py-2.5 font-semibold">Contratista</th>
              <th className="text-left px-6 py-2.5 font-semibold">Documentos</th>
              <th className="text-left px-6 py-2.5 font-semibold">Cumplimiento</th>
              <th className="text-left px-6 py-2.5 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {byContractor.map((c) => (
              <tr key={c.contractorId} className="border-t border-steel-100">
                <td className="px-6 py-3 font-medium text-steel-900">{c.name}</td>
                <td className="px-6 py-3 text-steel-600">
                  {c.approvedDocuments}/{c.totalDocuments} aprobados
                </td>
                <td className="px-6 py-3 text-steel-900 font-semibold">{c.complianceRate}%</td>
                <td className="px-6 py-3">
                  <Semaphore color={c.semaphore} />
                </td>
              </tr>
            ))}
            {byContractor.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-6 text-steel-400 text-center">
                  Aún no hay contratistas registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-white border border-steel-200 rounded-lg p-5">
      <div
        className={`font-display text-4xl font-black ${
          accent ? 'text-safety-500' : 'text-steel-900'
        }`}
      >
        {value}
      </div>
      <div className="text-steel-600 text-sm mt-1">{label}</div>
      {sub && <div className="text-steel-400 text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

function DocBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-steel-600 mb-1">
        <span>{label}</span>
        <span>{value} ({pct}%)</span>
      </div>
      <div className="h-2 bg-steel-100 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
