import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar as RBar, Legend } from 'recharts';
import { api } from '../../lib/api';
import { Bar, Card, Empty, EvidenceButtons, Kpi, Pct, DISCIPLINE_LABELS, DISCIPLINE_SHORT, fmtDate, fmtDateTime, inputBase } from './shared';
import TargetDrawer from './TargetDrawer';

const SEV: Record<string, string> = { alta: 'bg-rojo-600', media: 'bg-amarillo-600', baja: 'bg-steel-400' };

export default function InternalDashboard() {
  const [d, setD] = useState<any>(null);
  const [projectId, setProjectId] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  function load() {
    api.get('/internal/dashboard', { params: { projectId: projectId || undefined, discipline: discipline || undefined } }).then((r) => setD(r.data));
  }
  useEffect(load, [projectId, discipline]);
  useEffect(() => {
    api.get('/internal/projects').then((r) => setProjects(r.data.projects));
    const h = () => load();
    window.addEventListener('internal:refresh', h);
    return () => window.removeEventListener('internal:refresh', h);
  }, []);

  if (!d) return <p className="text-steel-400">Cargando indicadores…</p>;
  const k = d.kpis;

  if (k.obras === 0) {
    return (
      <Card>
        <Empty>
          Aún no hay obras con seguimiento interno. {d.scope.canEdit ? <Link to="/interna/obras" className="text-safety-600 font-semibold">Agrega una obra</Link> : 'Pide a la Coordinación SST que te asigne a una obra.'}
        </Empty>
      </Card>
    );
  }

  const chartWeeks = d.trend.weeks.map((w: any) => ({ ...w, pct: w.pct ?? null }));
  const chartMonths = d.trend.months.map((m: any) => ({ name: m.label, Ejecutadas: m.ejecutadas, Programadas: m.total, pct: m.pct }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <select className={`${inputBase} max-w-xs`} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Todas las obras</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
        <select className={`${inputBase} max-w-xs`} value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
          <option value="">Todos los roles</option>
          {Object.entries(DISCIPLINE_LABELS).map(([k2, v]) => (
            <option key={k2} value={k2}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-steel-200 rounded-lg p-4">
          <Pct value={k.last30.pct} size="lg" />
          <div className="text-steel-600 text-sm mt-1">Cumplimiento de actividades</div>
          <div className="text-steel-400 text-xs">últimos 30 días · mes: {k.month.pct ?? '—'}%</div>
        </div>
        <Kpi label="Actividades ejecutadas" value={k.last30.ejecutadas} sub={`${k.last30.tarde} fuera de plazo · 30 días`} tone="ok" />
        <Kpi label="Pendientes por entregar" value={k.last30.pendientes + k.last30.incompletas} sub="dentro de plazo o incompletas" />
        <Kpi label="Incumplimientos acumulados" value={k.pendientesAcumulados} sub="no ejecutadas / incompletas vencidas" tone={k.pendientesAcumulados ? 'alert' : undefined} />
        <div className="bg-white border border-steel-200 rounded-lg p-4">
          <Pct value={k.am196.pct} size="lg" />
          <div className="text-steel-600 text-sm mt-1">Cumplimiento AM 196</div>
          <div className="text-steel-400 text-xs">
            {k.am196.cumple + k.am196.por_actualizar} con evidencia · {k.am196.faltante} faltantes · {k.am196.vencido} vencidos
          </div>
        </div>
        <Kpi label="Documentos en OneDrive" value={k.archivos} sub={`${k.archivosMes} nuevos este mes`} />
        <Kpi label="Alertas abiertas" value={k.alertas} sub={`${k.alertasAltas} de severidad alta`} tone={k.alertasAltas ? 'alert' : undefined} />
        <Kpi label="Obras / personal" value={`${k.obras} / ${k.personal}`} sub="con seguimiento interno" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Evolución semanal del cumplimiento">
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={chartWeeks} margin={{ left: -20, right: 10, top: 5 }}>
                <CartesianGrid stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v: any) => (v === null ? '—' : `${v}%`)} labelFormatter={(l) => `Semana del ${l}`} />
                <Line type="monotone" dataKey="pct" name="Cumplimiento" stroke="#ea580c" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Evolución mensual: ejecutadas vs. programadas">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={chartMonths} margin={{ left: -20, right: 10, top: 5 }}>
                <CartesianGrid stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <RBar dataKey="Programadas" fill="#d7e0e8" />
                <RBar dataKey="Ejecutadas" fill="#15803d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Cumplimiento por obra">
        <table className="w-full text-sm">
          <thead className="text-steel-600 text-xs uppercase tracking-wide">
            <tr className="border-b border-steel-200">
              <th className="text-left py-2">Obra</th>
              <th className="text-left py-2 w-48">Actividades (30 días)</th>
              <th className="text-right py-2">Ejecutadas</th>
              <th className="text-right py-2">Incumpl.</th>
              <th className="text-left py-2 pl-6 w-48">AM 196</th>
              <th className="text-right py-2">Alertas</th>
            </tr>
          </thead>
          <tbody>
            {d.byProject.map((p: any) => (
              <tr key={p.id} className="border-b border-steel-100">
                <td className="py-2.5">
                  <Link to={`/interna/obras/${p.id}`} className="font-semibold text-steel-900 hover:text-safety-600">
                    {p.code}
                  </Link>
                  <div className="text-xs text-steel-600">{p.name}</div>
                </td>
                <td className="py-2.5">
                  <Pct value={p.last30.pct} />
                  <Bar value={p.last30.pct} />
                </td>
                <td className="py-2.5 text-right">{p.last30.ejecutadas}</td>
                <td className="py-2.5 text-right">{p.last30.vencidas}</td>
                <td className="py-2.5 pl-6">
                  <Pct value={p.am196.pct} />
                  <Bar value={p.am196.pct} />
                </td>
                <td className="py-2.5 text-right">{p.alerts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid lg:grid-cols-5 gap-6">
        <Card title="Cumplimiento por asistente" className="lg:col-span-3">
          <table className="w-full text-sm">
            <thead className="text-steel-600 text-xs uppercase tracking-wide">
              <tr className="border-b border-steel-200">
                <th className="text-left py-2">Persona</th>
                <th className="text-left py-2">Obra(s)</th>
                <th className="text-left py-2 w-36">30 días</th>
                <th className="text-right py-2">Mes</th>
                <th className="text-right py-2">Vencidas</th>
              </tr>
            </thead>
            <tbody>
              {d.byStaff.map((s: any) => (
                <tr key={s.id} className="border-b border-steel-100">
                  <td className="py-2">
                    <Link to={`/interna/personal?id=${s.id}`} className="font-medium text-steel-900 hover:text-safety-600">
                      {s.name}
                    </Link>
                    <div className="text-xs text-steel-600">{DISCIPLINE_LABELS[s.discipline]}</div>
                  </td>
                  <td className="py-2 text-xs text-steel-600">{s.projects.join(', ')}</td>
                  <td className="py-2">
                    <Pct value={s.last30.pct} />
                    <Bar value={s.last30.pct} />
                  </td>
                  <td className="py-2 text-right">{s.month.pct ?? '—'}%</td>
                  <td className="py-2 text-right">{s.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {d.byDiscipline.length > 1 && (
            <div className="flex flex-wrap gap-4 mt-4 text-sm">
              {d.byDiscipline.map((x: any) => (
                <div key={x.discipline} className="flex items-center gap-2">
                  <span className="text-steel-600">{DISCIPLINE_SHORT[x.discipline]}:</span> <Pct value={x.pct} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="AM 196 por sección" className="lg:col-span-2">
          <div className="space-y-3">
            {d.am196BySection.map((s: any) => (
              <div key={s.section}>
                <div className="flex justify-between text-xs text-steel-600 mb-1">
                  <span>{s.section}</span>
                  <span>
                    {s.cumple + s.por_actualizar}/{s.total} · <b>{s.pct ?? 0}%</b>
                  </span>
                </div>
                <Bar value={s.pct} />
              </div>
            ))}
          </div>
          <Link to="/interna/am196" className="text-sm text-safety-600 font-semibold mt-4 inline-block">
            Ver matriz completa →
          </Link>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Alertas de incumplimiento" actions={<Link to="/interna/alertas" className="text-sm text-safety-600 font-semibold">Ver todas</Link>}>
          {d.alerts.length === 0 ? (
            <Empty>Sin alertas abiertas.</Empty>
          ) : (
            <ul className="space-y-2">
              {d.alerts.map((a: any) => (
                <li key={a.id} className="flex gap-2 text-sm">
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${SEV[a.severity]}`} />
                  <button className="text-left text-steel-700 hover:text-steel-900" onClick={() => a.refType === 'activity' && setOpen(a.refId)}>
                    {a.message}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Próximos vencimientos">
          {d.upcoming.length === 0 ? (
            <Empty>Nada pendiente por entregar.</Empty>
          ) : (
            <ul className="divide-y divide-steel-100">
              {d.upcoming.map((u: any) => (
                <li key={u.id} className="py-2 flex justify-between gap-3 text-sm">
                  <button className="text-left hover:text-safety-600" onClick={() => setOpen(u.id)}>
                    <span className="font-medium">{u.projectCode}</span> · {u.name}
                  </button>
                  <span className="text-steel-600 shrink-0">{fmtDate(u.dueDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Trazabilidad: últimas evidencias registradas">
        {d.recentEvidence.length === 0 ? (
          <Empty>Sin evidencias aún.</Empty>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {d.recentEvidence.map((e: any) => (
                <tr key={e.id} className="border-b border-steel-100">
                  <td className="py-2 font-medium text-steel-700 w-24">{e.projectCode}</td>
                  <td className="py-2">
                    <div className="text-steel-900">{e.fileName}</div>
                    <div className="text-xs text-steel-400">{e.path}</div>
                  </td>
                  <td className="py-2 text-xs text-steel-600">{e.source === 'auto' ? 'OneDrive' : e.source === 'carga_sistema' ? 'Carga en sistema' : 'Vinculada'}</td>
                  <td className="py-2 text-xs text-steel-600">{e.addedBy || '—'}</td>
                  <td className="py-2 text-xs text-steel-600 whitespace-nowrap">{fmtDateTime(e.fileDate || e.createdAt)}</td>
                  <td className="py-2 text-right">
                    <EvidenceButtons id={e.id} webUrl={e.webUrl} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {open && <TargetDrawer targetType="activity" id={open} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  );
}
