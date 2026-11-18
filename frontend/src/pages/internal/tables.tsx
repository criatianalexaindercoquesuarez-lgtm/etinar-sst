import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { ActStatus, AmStatus, Empty, inputBase, DISCIPLINE_LABELS, DISCIPLINE_SHORT, FREQ_LABELS, fmtDate } from './shared';
import TargetDrawer from './TargetDrawer';

/** Tabla de actividades con filtros. */
export function ActivitiesTable({ projectId, staffId, showProject = true }: { projectId?: string; staffId?: string; showProject?: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [range, setRange] = useState('35');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  function load() {
    setLoading(true);
    const today = new Date();
    const from = new Date(today.getTime() - Number(range) * 86400000).toISOString().slice(0, 10);
    api
      .get('/internal/activities', { params: { projectId, staffId, status: status || undefined, from } })
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }
  useEffect(load, [projectId, staffId, status, range]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('internal:refresh', h);
    return () => window.removeEventListener('internal:refresh', h);
  }, [projectId, staffId, status, range]);

  const filtered = useMemo(
    () =>
      rows
        .filter((r) => !discipline || r.template.discipline === discipline)
        .filter((r) => !q || `${r.template.name} ${r.template.code} ${r.staff?.fullName} ${r.project?.code}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => (b.periodEnd || '').localeCompare(a.periodEnd) || a.template.code.localeCompare(b.template.code)),
    [rows, discipline, q],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [rows]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select className={`${inputBase} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="ejecutada">Ejecutadas ({counts.ejecutada || 0})</option>
          <option value="pendiente">Pendientes ({counts.pendiente || 0})</option>
          <option value="incompleta">Incompletas ({counts.incompleta || 0})</option>
          <option value="vencida">No ejecutadas ({counts.vencida || 0})</option>
          <option value="no_aplica">No aplica</option>
        </select>
        <select className={`${inputBase} w-auto`} value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
          <option value="">Todos los roles</option>
          {Object.entries(DISCIPLINE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select className={`${inputBase} w-auto`} value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="35">Últimas 5 semanas</option>
          <option value="95">Últimos 3 meses</option>
          <option value="190">Últimos 6 meses</option>
          <option value="400">Último año</option>
        </select>
        <input className={`${inputBase} w-56`} placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="bg-white border border-steel-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-steel-50 text-steel-600 text-xs uppercase tracking-wide">
            <tr>
              {showProject && <th className="text-left px-4 py-2.5">Obra</th>}
              <th className="text-left px-4 py-2.5">Actividad</th>
              <th className="text-left px-4 py-2.5">Período</th>
              <th className="text-left px-4 py-2.5">Responsable</th>
              <th className="text-left px-4 py-2.5">Límite</th>
              <th className="text-center px-4 py-2.5">Evid.</th>
              <th className="text-left px-4 py-2.5">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-steel-100 hover:bg-steel-50 cursor-pointer" onClick={() => setOpen(r.id)}>
                {showProject && <td className="px-4 py-2 font-medium">{r.project?.code}</td>}
                <td className="px-4 py-2">
                  <div className="text-steel-900">{r.template.name}</div>
                  <div className="text-xs text-steel-400">
                    {r.template.code} · {DISCIPLINE_SHORT[r.template.discipline]} · {FREQ_LABELS[r.template.frequency]}
                    {r.review === 'validada' ? ' · validada' : r.review === 'observada' ? ' · observada' : ''}
                  </div>
                </td>
                <td className="px-4 py-2 text-xs text-steel-600 whitespace-nowrap">
                  {fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}
                </td>
                <td className="px-4 py-2 text-steel-700">{r.staff?.fullName || <span className="text-steel-400">Sin asignar</span>}</td>
                <td className="px-4 py-2 whitespace-nowrap">{fmtDate(r.dueDate)}</td>
                <td className="px-4 py-2 text-center">
                  {r.evidenceCount}/{r.template.minEvidence}
                </td>
                <td className="px-4 py-2">
                  <ActStatus status={r.status} late={r.late} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && <Empty>No hay actividades con estos filtros.</Empty>}
        {loading && <Empty>Cargando…</Empty>}
      </div>
      {open && <TargetDrawer targetType="activity" id={open} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  );
}

/** Matriz AM 196 de una obra. */
export function Am196Table({ projectId }: { projectId: string }) {
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState('');
  const [section, setSection] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  function load() {
    api.get(`/internal/projects/${projectId}/am196`).then((r) => setData(r.data));
  }
  useEffect(load, [projectId]);

  if (!data) return <p className="text-steel-400">Cargando matriz…</p>;
  const sections = [...new Set(data.items.map((i: any) => i.requirement.section))] as string[];
  const items = data.items
    .filter((i: any) => !status || i.status === status)
    .filter((i: any) => !section || i.requirement.section === section)
    .filter((i: any) => !q || `${i.requirement.code} ${i.requirement.description}`.toLowerCase().includes(q.toLowerCase()));
  const s = data.stats;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          ['', `Todos (${data.items.length})`],
          ['cumple', `Cumple (${s.cumple})`],
          ['por_actualizar', `Por actualizar (${s.por_actualizar})`],
          ['vencido', `Vencidos (${s.vencido})`],
          ['faltante', `Faltantes (${s.faltante})`],
          ['observado', `Observados (${s.observado})`],
          ['no_aplica', `No aplica (${s.no_aplica})`],
        ].map(([k, label]) => (
          <button key={k} onClick={() => setStatus(k)} className={`px-3 py-1.5 rounded-full border ${status === k ? 'bg-steel-900 text-white border-steel-900' : 'border-steel-200 text-steel-700 hover:bg-steel-50'}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <select className={`${inputBase} w-auto`} value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="">Todas las secciones</option>
          {sections.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <input className={`${inputBase} w-64`} placeholder="Buscar requisito…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="bg-white border border-steel-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-steel-50 text-steel-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2.5">Código</th>
              <th className="text-left px-4 py-2.5">Requisito</th>
              <th className="text-left px-4 py-2.5">Responsable</th>
              <th className="text-left px-4 py-2.5">Actualizado</th>
              <th className="text-left px-4 py-2.5">Vence</th>
              <th className="text-center px-4 py-2.5">Evid.</th>
              <th className="text-left px-4 py-2.5">Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i: any) => {
              const staff = data.staff.find((x: any) => x.id === i.responsibleStaffId);
              return (
                <tr key={i.id} className="border-t border-steel-100 hover:bg-steel-50 cursor-pointer" onClick={() => setOpen(i.id)}>
                  <td className="px-4 py-2 font-mono text-xs">{i.requirement.code}</td>
                  <td className="px-4 py-2">
                    <div className="text-steel-900">{i.requirement.description}</div>
                    <div className="text-xs text-steel-400">
                      {i.requirement.legalRef}
                      {i.requirement.evidenceType === 'in_situ' ? ' · verificación en campo' : ''}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs text-steel-700">{staff?.fullName || i.responsibleName || <span className="text-steel-400">—</span>}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{fmtDate(i.lastUpdateDate)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{i.requirement.validityDays ? fmtDate(i.expiresAt) : 'No vence'}</td>
                  <td className="px-4 py-2 text-center">{i.evidenceCount}</td>
                  <td className="px-4 py-2">
                    <AmStatus status={i.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 && <Empty>Sin requisitos con estos filtros.</Empty>}
      </div>
      {open && <TargetDrawer targetType="am196" id={open} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  );
}
