import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Copy, KeyRound, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import {
  ActStatus,
  AmStatus,
  Bar,
  Card,
  Drawer,
  Empty,
  Modal,
  Pct,
  btnPrimary,
  btnSecondary,
  errMsg,
  fmtDate,
  fmtDateTime,
  inputCls,
  inputBase,
  semaphore,
  DISCIPLINE_LABELS,
} from './shared';
import { ActivitiesTable } from './tables';
import TargetDrawer from './TargetDrawer';

/* ------------------------------------------------------------------ */
export function InternalActivitiesPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState('');
  useEffect(() => {
    api.get('/internal/projects').then((r) => setProjects(r.data.projects));
  }, []);
  return (
    <div className="space-y-3">
      <select className={`${inputBase} max-w-xs`} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
        <option value="">Todas las obras</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} — {p.name}
          </option>
        ))}
      </select>
      <ActivitiesTable projectId={projectId || undefined} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
const CELL: Record<string, string> = { verde: 'bg-verde-100 text-verde-600', amarillo: 'bg-amarillo-100 text-amarillo-600', rojo: 'bg-rojo-100 text-rojo-600', gris: 'bg-steel-50 text-steel-400' };

export function InternalAm196Page() {
  const [m, setM] = useState<any>(null);
  useEffect(() => {
    api.get('/internal/am196/matrix').then((r) => setM(r.data));
  }, []);
  if (!m) return <p className="text-steel-400">Cargando matriz…</p>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-steel-600">
        Requisitos del Anexo 1 (Lista de verificación SST) del Acuerdo Ministerial MDT-2024-196, evaluados por obra con la evidencia real de OneDrive. % = requisitos con evidencia vigente ÷ requisitos aplicables.
      </p>
      <Card title="Cumplimiento AM 196 por obra y sección">
        {m.projects.length === 0 ? (
          <Empty>Sin obras con seguimiento.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-steel-600 text-xs uppercase tracking-wide">
                <tr className="border-b border-steel-200">
                  <th className="text-left py-2 pr-4">Obra</th>
                  <th className="text-center py-2 px-2">Total</th>
                  {m.sections.map((s: string) => (
                    <th key={s} className="text-center py-2 px-2 normal-case font-semibold">
                      {s}
                    </th>
                  ))}
                  <th className="text-center py-2 px-2">Vencidos</th>
                  <th className="text-center py-2 px-2">Faltantes</th>
                </tr>
              </thead>
              <tbody>
                {m.projects.map((p: any) => (
                  <tr key={p.id} className="border-b border-steel-100">
                    <td className="py-2 pr-4">
                      <Link to={`/interna/obras/${p.id}?tab=am196`} className="font-semibold hover:text-safety-600">
                        {p.code}
                      </Link>
                      <div className="text-xs text-steel-600">{p.name}</div>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Pct value={p.total.pct} />
                    </td>
                    {m.sections.map((s: string) => {
                      const x = p.bySection[s];
                      return (
                        <td key={s} className="py-2 px-2 text-center">
                          <span className={`inline-block min-w-16 px-2 py-1 rounded text-xs font-semibold ${CELL[semaphore(x.pct)]}`}>
                            {x.pct ?? '—'}%
                            <span className="block font-normal">
                              {x.cumple + x.por_actualizar}/{x.total}
                            </span>
                          </span>
                        </td>
                      );
                    })}
                    <td className="py-2 px-2 text-center text-rojo-600 font-semibold">{p.total.vencido}</td>
                    <td className="py-2 px-2 text-center">{p.total.faltante}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-steel-400">Abre una obra para ver la matriz detallada, asignar responsables, cargar evidencias o validar requisitos.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function InternalStaffPage() {
  const { user } = useAuth();
  const canEdit = user && ['admin', 'coordinador_sst'].includes(user.role);
  const [rows, setRows] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({ fullName: '', email: '', discipline: 'sst', jobTitle: '', phone: '', projectId: '', startDate: new Date().toISOString().slice(0, 10) });
  const [err, setErr] = useState('');
  const [cred, setCred] = useState<any>(null);
  const [sp, setSp] = useSearchParams();
  const openId = sp.get('id');

  function load() {
    api.get('/internal/staff').then((r) => setRows(r.data));
  }
  useEffect(() => {
    load();
    api.get('/internal/projects').then((r) => setProjects([...r.data.projects, ...r.data.available]));
  }, []);

  async function create() {
    setErr('');
    try {
      await api.post('/internal/staff', { ...form, projectId: form.projectId || undefined });
      setShow(false);
      setForm({ ...form, fullName: '', email: '', jobTitle: '', phone: '' });
      load();
    } catch (e) {
      setErr(errMsg(e));
    }
  }
  async function access(s: any) {
    try {
      const { data } = await api.post(`/internal/staff/${s.id}/access`);
      setCred(data.temporaryPassword ? data : { email: data.email, linked: true });
      load();
    } catch (e) {
      alert(errMsg(e));
    }
  }
  async function toggle(s: any) {
    await api.put(`/internal/staff/${s.id}`, { active: !s.active });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-steel-600">Asistentes SST, ambientales, médicos y de gestión social por obra.</p>
        {canEdit && (
          <button className={btnPrimary} onClick={() => setShow(true)}>
            <Plus size={16} /> Registrar persona
          </button>
        )}
      </div>
      <div className="bg-white border border-steel-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-steel-50 text-steel-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2.5">Persona</th>
              <th className="text-left px-4 py-2.5">Rol</th>
              <th className="text-left px-4 py-2.5">Obras</th>
              <th className="text-left px-4 py-2.5 w-40">Cumplimiento (90 días)</th>
              <th className="text-left px-4 py-2.5">Acceso</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className={`border-t border-steel-100 ${s.active ? '' : 'opacity-50'}`}>
                <td className="px-4 py-2">
                  <button className="font-medium text-steel-900 hover:text-safety-600" onClick={() => setSp({ id: s.id })}>
                    {s.fullName}
                  </button>
                  <div className="text-xs text-steel-400">
                    {s.email}
                    {s.jobTitle ? ` · ${s.jobTitle}` : ''}
                  </div>
                </td>
                <td className="px-4 py-2 text-steel-700">{DISCIPLINE_LABELS[s.discipline]}</td>
                <td className="px-4 py-2 text-xs">
                  {s.assignments
                    .filter((a: any) => a.active)
                    .map((a: any) => a.code)
                    .join(', ') || <span className="text-steel-400">—</span>}
                </td>
                <td className="px-4 py-2">
                  <Pct value={s.stats.pct} />
                  <Bar value={s.stats.pct} />
                </td>
                <td className="px-4 py-2 text-xs">
                  {s.hasAccess ? (
                    <span className="text-verde-600 font-semibold">Con acceso</span>
                  ) : canEdit ? (
                    <button className="text-safety-600 font-semibold hover:underline inline-flex items-center gap-1" onClick={() => access(s)}>
                      <KeyRound size={12} /> Dar acceso
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {canEdit && (
                    <button className="text-xs text-steel-600 hover:underline" onClick={() => toggle(s)}>
                      {s.active ? 'Desactivar' : 'Activar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty>Sin personal registrado.</Empty>}
      </div>

      {show && (
        <Modal title="Registrar persona" onClose={() => setShow(false)}>
          <div className="space-y-3">
            <input className={inputCls} placeholder="Nombre completo" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            <input className={inputCls} placeholder="Correo institucional (@etinar.com)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <select className={inputCls} value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })}>
              {Object.entries(DISCIPLINE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <input className={inputCls} placeholder="Cargo (opcional)" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
            <input className={inputCls} placeholder="Teléfono (opcional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <select className={inputCls} value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                <option value="">Asignar a obra… (opcional)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
              <input type="date" className={inputCls} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            {err && <p className="text-sm text-rojo-600">{err}</p>}
            <button className={btnPrimary} onClick={create} disabled={!form.fullName || !form.email}>
              Guardar
            </button>
          </div>
        </Modal>
      )}

      {cred && (
        <Modal title="Acceso creado" onClose={() => setCred(null)}>
          {cred.linked ? (
            <p className="text-sm">Se vinculó el usuario existente {cred.email}.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <p>Comparte estas credenciales con la persona. Solo verá y cargará evidencias de sus obras en Documentación Interna.</p>
              <pre className="bg-steel-50 border border-steel-200 rounded p-3 text-xs">
                Usuario: {cred.email}
                {'\n'}Contraseña temporal: {cred.temporaryPassword}
                {'\n'}URL: {window.location.origin}
              </pre>
              <button className={btnSecondary} onClick={() => navigator.clipboard.writeText(`Usuario: ${cred.email}\nContraseña temporal: ${cred.temporaryPassword}\nURL: ${window.location.origin}`)}>
                <Copy size={14} /> Copiar
              </button>
            </div>
          )}
        </Modal>
      )}

      {openId && <StaffDrawer id={openId} onClose={() => setSp({})} />}
    </div>
  );
}

function StaffDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [d, setD] = useState<any>(null);
  const [open, setOpen] = useState<{ t: 'activity' | 'am196'; id: string } | null>(null);
  useEffect(() => {
    api.get(`/internal/staff/${id}`).then((r) => setD(r.data));
  }, [id]);
  if (!d) return <Drawer title="Cargando…" onClose={onClose}><div /></Drawer>;
  return (
    <Drawer title={d.staff.fullName} subtitle={`${DISCIPLINE_LABELS[d.staff.discipline]} · ${d.staff.email}`} onClose={onClose} wide>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border border-steel-200 rounded p-3">
          <Pct value={d.stats.pct} size="lg" />
          <div className="text-xs text-steel-600">Cumplimiento individual</div>
        </div>
        <div className="border border-steel-200 rounded p-3">
          <div className="font-display text-2xl font-black">{d.stats.ejecutadas}</div>
          <div className="text-xs text-steel-600">Ejecutadas ({d.stats.tarde} tarde)</div>
        </div>
        <div className="border border-steel-200 rounded p-3">
          <div className="font-display text-2xl font-black text-rojo-600">{d.stats.vencidas}</div>
          <div className="text-xs text-steel-600">No ejecutadas</div>
        </div>
        <div className="border border-steel-200 rounded p-3">
          <div className="font-display text-2xl font-black">{d.stats.pendientes + d.stats.incompletas}</div>
          <div className="text-xs text-steel-600">Pendientes / incompletas</div>
        </div>
      </div>
      <div>
        <h3 className="font-semibold mb-2">Evolución semanal</h3>
        <div className="h-44">
          <ResponsiveContainer>
            <LineChart data={d.trend.weeks} margin={{ left: -20, right: 10 }}>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => (v === null ? '—' : `${v}%`)} />
              <Line dataKey="pct" stroke="#ea580c" strokeWidth={2} connectNulls name="Cumplimiento" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <h3 className="font-semibold mb-2">Historial de actividades</h3>
        <table className="w-full text-sm">
          <tbody>
            {d.activities.slice(0, 80).map((a: any) => (
              <tr key={a.id} className="border-b border-steel-100 hover:bg-steel-50 cursor-pointer" onClick={() => setOpen({ t: 'activity', id: a.id })}>
                <td className="py-1.5 text-xs">{a.project?.code}</td>
                <td className="py-1.5">{a.template?.name}</td>
                <td className="py-1.5 text-xs text-steel-600">{a.periodKey}</td>
                <td className="py-1.5 text-xs whitespace-nowrap">{fmtDate(a.dueDate)}</td>
                <td className="py-1.5">
                  <ActStatus status={a.status} late={a.late} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {d.am196Items.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">Requisitos AM 196 a su cargo pendientes</h3>
          <ul className="text-sm space-y-1">
            {d.am196Items.map((i: any) => (
              <li key={i.id} className="flex items-center gap-2 cursor-pointer hover:text-safety-600" onClick={() => setOpen({ t: 'am196', id: i.id })}>
                <AmStatus status={i.status} /> {i.project?.code} · {i.requirement.code} {i.requirement.description}
              </li>
            ))}
          </ul>
        </div>
      )}
      {open && <TargetDrawer targetType={open.t} id={open.id} onClose={() => setOpen(null)} />}
    </Drawer>
  );
}

/* ------------------------------------------------------------------ */
const TYPE_LABEL: Record<string, string> = {
  actividad_vencida: 'Actividad no ejecutada',
  actividad_incompleta: 'Actividad incompleta',
  am196_vencido: 'AM 196 vencido',
  am196_por_actualizar: 'AM 196 por actualizar',
  am196_faltante: 'AM 196 faltante',
  am196_observado: 'AM 196 observado',
  onedrive_error: 'Error de OneDrive',
};

export function InternalAlertsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [resolved, setResolved] = useState(false);
  const [type, setType] = useState('');
  const [open, setOpen] = useState<{ t: 'activity' | 'am196'; id: string } | null>(null);
  function load() {
    api.get('/internal/alerts', { params: { resolved: resolved ? '1' : undefined, type: type || undefined } }).then((r) => setRows(r.data));
  }
  useEffect(load, [resolved, type]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <select className={`${inputBase} w-auto`} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label className="text-sm text-steel-700 flex items-center gap-2">
          <input type="checkbox" checked={resolved} onChange={(e) => setResolved(e.target.checked)} /> Ver resueltas
        </label>
        <span className="text-xs text-steel-400">Las alertas se generan y se cierran automáticamente según el estado real de las actividades y documentos.</span>
      </div>
      <div className="bg-white border border-steel-200 rounded-lg">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-steel-100 hover:bg-steel-50 cursor-pointer" onClick={() => (a.refType === 'activity' || a.refType === 'am196') && setOpen({ t: a.refType, id: a.refId })}>
                <td className="px-4 py-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${a.severity === 'alta' ? 'bg-rojo-600' : a.severity === 'media' ? 'bg-amarillo-600' : 'bg-steel-400'}`} />
                </td>
                <td className="py-2 text-xs font-semibold text-steel-700 whitespace-nowrap">{a.projectCode}</td>
                <td className="px-3 py-2 text-xs text-steel-600 whitespace-nowrap">{TYPE_LABEL[a.type] || a.type}</td>
                <td className="px-3 py-2 text-steel-800">{a.message}</td>
                <td className="px-4 py-2 text-xs text-steel-400 whitespace-nowrap">{fmtDateTime(resolved ? a.resolvedAt : a.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty>Sin alertas.</Empty>}
      </div>
      {open && <TargetDrawer targetType={open.t} id={open.id} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  );
}
