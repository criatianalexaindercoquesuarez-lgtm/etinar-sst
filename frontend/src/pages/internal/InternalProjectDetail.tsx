import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, ExternalLink, FileText, Folder, FolderPlus, Link2, RefreshCw, Trash2, UserPlus } from 'lucide-react';
import { api } from '../../lib/api';
import {
  Card,
  Empty,
  Kpi,
  Pct,
  btnPrimary,
  btnSecondary,
  errMsg,
  fmtDate,
  fmtDateTime,
  inputCls,
  inputBase,
  openDriveItem,
  DISCIPLINE_LABELS,
  FREQ_LABELS,
  PURPOSE_LABELS,
} from './shared';
import { ActivitiesTable, Am196Table } from './tables';
import LinkFolderModal from './LinkFolderModal';

const TABS = [
  ['resumen', 'Resumen'],
  ['actividades', 'Actividades'],
  ['am196', 'Matriz AM 196'],
  ['onedrive', 'Carpetas OneDrive'],
  ['personal', 'Personal asignado'],
  ['config', 'Obligaciones de la obra'],
];

export default function InternalProjectDetail() {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || (sp.get('nuevo') ? 'onedrive' : 'resumen');
  const [d, setD] = useState<any>(null);

  function load() {
    api.get(`/internal/projects/${id}`).then((r) => setD(r.data));
  }
  useEffect(load, [id]);

  if (!d) return <p className="text-steel-400">Cargando…</p>;
  const p = d.project;

  return (
    <div className="space-y-5">
      <div>
        <Link to="/interna/obras" className="text-sm text-steel-600 hover:text-steel-900 inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Obras
        </Link>
        <h2 className="font-display text-2xl font-black text-steel-900 mt-1">
          {p.code} · {p.name}
        </h2>
        <p className="text-sm text-steel-600">
          {p.client} · {p.city} · Director: {p.director} · Coordinador SST: {p.sstCoordinator}
        </p>
      </div>

      {sp.get('nuevo') && d.links.length === 0 && (
        <div className="bg-safety-100 border border-safety-400 text-steel-900 text-sm rounded p-3">
          <b>Paso 1:</b> vincula las carpetas de OneDrive de la obra (general, SST, Ministerio del Trabajo / AM 196…). <b>Paso 2:</b> asigna a los asistentes en "Personal asignado". El sistema generará sus actividades y la matriz AM 196 automáticamente.
        </div>
      )}

      <nav className="flex flex-wrap gap-1">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setSp({ tab: k })}
            className={`px-3 py-1.5 text-sm rounded ${tab === k ? 'bg-steel-900 text-white' : 'text-steel-700 hover:bg-steel-100'}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'resumen' && <Summary d={d} />}
      {tab === 'actividades' && <ActivitiesTable projectId={id} showProject={false} />}
      {tab === 'am196' && <Am196Table projectId={id!} />}
      {tab === 'onedrive' && <Links d={d} reload={load} />}
      {tab === 'personal' && <Staff d={d} reload={load} />}
      {tab === 'config' && <ActivityConfig projectId={id!} d={d} />}
    </div>
  );
}

function Summary({ d }: { d: any }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-steel-200 rounded-lg p-4">
          <Pct value={d.stats.pct} size="lg" />
          <div className="text-steel-600 text-sm mt-1">Cumplimiento de actividades</div>
          <div className="text-xs text-steel-400">histórico de la obra</div>
        </div>
        <div className="bg-white border border-steel-200 rounded-lg p-4">
          <Pct value={d.am196.pct} size="lg" />
          <div className="text-steel-600 text-sm mt-1">Cumplimiento AM 196</div>
          <div className="text-xs text-steel-400">
            {d.am196.faltante} faltantes · {d.am196.vencido} vencidos · {d.am196.por_actualizar} por actualizar
          </div>
        </div>
        <Kpi label="No ejecutadas" value={d.stats.vencidas} tone={d.stats.vencidas ? 'alert' : undefined} sub={`${d.stats.incompletas} incompletas`} />
        <Kpi label="Archivos indexados" value={d.fileCount} sub={`${d.links.length} carpeta(s) vinculada(s)`} />
      </div>
      <Card title="Cumplimiento por asistente">
        {d.assignments.filter((a: any) => a.active).length === 0 ? (
          <Empty>Sin personal asignado.</Empty>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {d.assignments
                .filter((a: any) => a.active)
                .map((a: any) => (
                  <tr key={a.id} className="border-b border-steel-100">
                    <td className="py-2 font-medium">{a.staff.fullName}</td>
                    <td className="py-2 text-steel-600">{DISCIPLINE_LABELS[a.staff.discipline]}</td>
                    <td className="py-2">
                      <Pct value={a.stats.pct} />
                    </td>
                    <td className="py-2 text-xs text-steel-600">
                      {a.stats.ejecutadas} ejecutadas · {a.stats.vencidas} no ejecutadas · {a.stats.pendientes} pendientes
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card title={`Alertas abiertas (${d.alerts.length})`}>
        {d.alerts.length === 0 ? (
          <Empty>Sin alertas.</Empty>
        ) : (
          <ul className="space-y-1.5 text-sm max-h-80 overflow-y-auto">
            {d.alerts.map((a: any) => (
              <li key={a.id} className="flex gap-2">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${a.severity === 'alta' ? 'bg-rojo-600' : a.severity === 'media' ? 'bg-amarillo-600' : 'bg-steel-400'}`} />
                <span className="text-steel-700">{a.message}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Links({ d, reload }: { d: any; reload: () => void }) {
  const [show, setShow] = useState(false);
  const [browse, setBrowse] = useState<string | null>(d.links[0]?.id || null);
  const [scanning, setScanning] = useState<string | null>(null);

  async function scan(linkId: string) {
    setScanning(linkId);
    try {
      const { data } = await api.post(`/internal/links/${linkId}/scan`);
      if (!data.ok) alert(data.error);
      reload();
      window.dispatchEvent(new Event('internal:refresh'));
    } finally {
      setScanning(null);
    }
  }

  async function remove(linkId: string) {
    if (!confirm('¿Desvincular esta carpeta? En OneDrive no se borra ni modifica nada.')) return;
    await api.delete(`/internal/links/${linkId}`);
    reload();
  }

  return (
    <div className="space-y-4">
      <Card
        title="Carpetas de OneDrive / SharePoint vinculadas"
        actions={
          d.canEdit && (
            <button className={btnPrimary} onClick={() => setShow(true)}>
              <Link2 size={15} /> Vincular carpeta
            </button>
          )
        }
      >
        {d.links.length === 0 ? (
          <Empty>Sin carpetas vinculadas.</Empty>
        ) : (
          <ul className="divide-y divide-steel-100">
            {d.links.map((l: any) => (
              <li key={l.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-steel-900 flex items-center gap-2">
                    <Folder size={16} className="text-safety-500" /> {l.label || l.folderName || 'Carpeta'}
                    <span className="text-xs font-normal text-steel-400">{PURPOSE_LABELS[l.purpose] || l.purpose}</span>
                  </div>
                  <div className="text-xs text-steel-600 mt-0.5">
                    {l.folderName || l.sourceUrl} ·{' '}
                    {l.status === 'verificado' ? (
                      <span className="text-verde-600">verificada</span>
                    ) : l.status === 'error' ? (
                      <span className="text-rojo-600">error: {l.lastError}</span>
                    ) : (
                      <span className="text-amarillo-600">sin verificar (se verificará al activar Microsoft 365)</span>
                    )}{' '}
                    · {l.itemCount} archivos · última lectura {fmtDateTime(l.lastScanAt)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {l.webUrl && (
                    <a className={btnSecondary} href={l.webUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={14} /> Abrir
                    </a>
                  )}
                  <button className={btnSecondary} onClick={() => setBrowse(l.id)}>
                    Explorar
                  </button>
                  <button className={btnSecondary} onClick={() => scan(l.id)} disabled={scanning === l.id}>
                    <RefreshCw size={14} className={scanning === l.id ? 'animate-spin' : ''} /> Leer
                  </button>
                  {d.canEdit && (
                    <button className={btnSecondary} onClick={() => remove(l.id)} title="Desvincular">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {browse && <Explorer linkId={browse} canEdit={d.canEdit} />}

      {show && (
        <LinkFolderModal projectId={d.project.id} projectName={`${d.project.code} · ${d.project.name}`} onClose={() => setShow(false)} onDone={() => { setShow(false); reload(); setTimeout(reload, 2000); }} />
      )}
    </div>
  );
}

function Explorer({ linkId, canEdit }: { linkId: string; canEdit: boolean }) {
  const [path, setPath] = useState('');
  const [data, setData] = useState<any>(null);

  function load() {
    api.get(`/internal/links/${linkId}/browse`, { params: { path } }).then((r) => setData(r.data));
  }
  useEffect(load, [linkId, path]);
  useEffect(() => setPath(''), [linkId]);

  async function mkdir() {
    const name = prompt('Nombre de la nueva carpeta en OneDrive:');
    if (!name) return;
    try {
      await api.post(`/internal/links/${linkId}/folders`, { parentPath: path, name });
      load();
    } catch (e) {
      alert(errMsg(e));
    }
  }

  if (!data) return null;
  const crumbs = path ? path.split('/') : [];
  return (
    <Card
      title={
        <span className="flex items-center gap-1 text-sm flex-wrap">
          <button className="hover:text-safety-600" onClick={() => setPath('')}>
            {data.link.label || data.link.folderName}
          </button>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight size={14} className="text-steel-400" />
              <button className="hover:text-safety-600" onClick={() => setPath(crumbs.slice(0, i + 1).join('/'))}>
                {c}
              </button>
            </span>
          ))}
        </span>
      }
      actions={
        canEdit && (
          <button className={btnSecondary} onClick={mkdir}>
            <FolderPlus size={14} /> Nueva carpeta
          </button>
        )
      }
    >
      {data.items.length === 0 ? (
        <Empty>Carpeta vacía (o aún no leída desde OneDrive).</Empty>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {data.items.map((it: any) => (
              <tr key={it.id} className="border-b border-steel-100 hover:bg-steel-50">
                <td className="py-1.5">
                  {it.isFolder ? (
                    <button className="flex items-center gap-2 text-steel-900 hover:text-safety-600" onClick={() => setPath(it.path)}>
                      <Folder size={16} className="text-safety-500" /> {it.name}
                    </button>
                  ) : (
                    <button className="flex items-center gap-2 text-steel-700 hover:text-safety-600 text-left" onClick={() => openDriveItem(it.id).catch((e) => alert(errMsg(e)))}>
                      <FileText size={16} className="text-steel-400 shrink-0" /> {it.name}
                    </button>
                  )}
                </td>
                <td className="py-1.5 text-xs text-steel-600">{it.isFolder ? `${it.fileCount} archivo(s)` : it.modifiedByName || it.createdByName || ''}</td>
                <td className="py-1.5 text-xs text-steel-600 whitespace-nowrap">{fmtDate(it.fileModifiedAt?.slice(0, 10))}</td>
                <td className="py-1.5 text-xs text-right">{!it.isFolder && it.linkedAs > 0 && <span className="text-verde-600 font-semibold">evidencia</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function Staff({ d, reload }: { d: any; reload: () => void }) {
  const [all, setAll] = useState<any[]>([]);
  const [pick, setPick] = useState('');
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/internal/staff').then((r) => setAll(r.data));
  }, []);

  async function assign() {
    setErr('');
    try {
      await api.post(`/internal/staff/${pick}/assignments`, { projectId: d.project.id, startDate: start });
      setPick('');
      reload();
    } catch (e) {
      setErr(errMsg(e));
    }
  }
  async function end(id: string) {
    if (!confirm('¿Retirar a esta persona de la obra? Su historial se conserva.')) return;
    await api.delete(`/internal/assignments/${id}`);
    reload();
  }

  const assignedIds = new Set(d.assignments.filter((a: any) => a.active).map((a: any) => a.staffId));
  return (
    <div className="space-y-4">
      <Card title="Personal asignado a la obra">
        <table className="w-full text-sm">
          <tbody>
            {d.assignments.map((a: any) => (
              <tr key={a.id} className={`border-b border-steel-100 ${a.active ? '' : 'opacity-50'}`}>
                <td className="py-2 font-medium">{a.staff.fullName}</td>
                <td className="py-2 text-steel-600">{DISCIPLINE_LABELS[a.staff.discipline]}</td>
                <td className="py-2 text-xs text-steel-600">{a.staff.email}</td>
                <td className="py-2 text-xs text-steel-600">
                  desde {fmtDate(a.startDate)}
                  {a.endDate ? ` hasta ${fmtDate(a.endDate)}` : ''}
                </td>
                <td className="py-2">
                  <Pct value={a.stats.pct} />
                </td>
                <td className="py-2 text-right">
                  {d.canEdit && a.active && (
                    <button className="text-xs text-rojo-600 hover:underline" onClick={() => end(a.id)}>
                      Retirar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {d.assignments.length === 0 && <Empty>Sin personal asignado.</Empty>}
      </Card>
      {d.canEdit && (
        <Card title="Asignar persona">
          <div className="flex flex-wrap gap-2 items-end">
            <label className="text-xs text-steel-600">
              Persona
              <select className={`${inputBase} min-w-64`} value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Selecciona…</option>
                {all
                  .filter((s) => !assignedIds.has(s.id) && s.active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} — {DISCIPLINE_LABELS[s.discipline]}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-xs text-steel-600">
              Desde
              <input type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <button className={btnPrimary} disabled={!pick} onClick={assign}>
              <UserPlus size={15} /> Asignar
            </button>
            <Link to="/interna/personal" className="text-sm text-safety-600 font-semibold ml-2">
              Registrar nueva persona →
            </Link>
          </div>
          {err && <p className="text-sm text-rojo-600 mt-2">{err}</p>}
          <p className="text-xs text-steel-400 mt-2">Al asignar, el sistema genera sus actividades desde la fecha indicada (máximo 8 semanas hacia atrás) y las evalúa con lo que ya existe en OneDrive.</p>
        </Card>
      )}
    </div>
  );
}

function ActivityConfig({ projectId, d }: { projectId: string; d: any }) {
  const [rows, setRows] = useState<any[]>([]);
  const [folders, setFolders] = useState<{ linkId: string; path: string }[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  function load() {
    api.get(`/internal/projects/${projectId}/activity-config`).then((r) => setRows(r.data));
    api.get(`/internal/projects/${projectId}/folders`).then((r) => setFolders(r.data));
  }
  useEffect(load, [projectId]);

  async function save(templateId: string, body: any) {
    setSaving(templateId);
    try {
      await api.put(`/internal/projects/${projectId}/activity-config/${templateId}`, body);
      load();
    } catch (e) {
      alert(errMsg(e));
    } finally {
      setSaving(null);
    }
  }

  const staffBy = (disc: string) => d.assignments.filter((a: any) => a.active && a.staff.discipline === disc).map((a: any) => a.staff);

  return (
    <Card title="Obligaciones de la obra">
      <p className="text-xs text-steel-600 mb-3">
        Activa o desactiva obligaciones para esta obra y, si quieres precisión total, indica la subcarpeta exacta de OneDrive donde se guarda cada evidencia. Sin carpeta, el sistema la reconoce por palabras clave dentro de la carpeta de la disciplina.
      </p>
      <datalist id="cfg-folders">
        {folders.map((f) => (
          <option key={f.linkId + f.path} value={f.path} />
        ))}
      </datalist>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-steel-600 text-xs uppercase tracking-wide">
            <tr className="border-b border-steel-200">
              <th className="text-left py-2">Aplica</th>
              <th className="text-left py-2">Obligación</th>
              <th className="text-left py-2">Frecuencia</th>
              <th className="text-left py-2">Carpeta de evidencia en OneDrive</th>
              <th className="text-left py-2">Responsable</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ template: t, config: c, staffed }) => (
              <tr key={t.id} className={`border-b border-steel-100 ${staffed ? '' : 'opacity-50'}`}>
                <td className="py-2">
                  <input type="checkbox" disabled={!d.canEdit || saving === t.id} checked={c ? c.enabled : true} onChange={(e) => save(t.id, { enabled: e.target.checked })} />
                </td>
                <td className="py-2">
                  <div className="text-steel-900">{t.name}</div>
                  <div className="text-xs text-steel-400">
                    {t.code} · {DISCIPLINE_LABELS[t.discipline]}
                    {!staffed && ' · sin persona asignada de este rol'}
                  </div>
                </td>
                <td className="py-2 text-xs">{FREQ_LABELS[t.frequency]}</td>
                <td className="py-2">
                  <input
                    className={`${inputCls} text-xs py-1`}
                    list="cfg-folders"
                    defaultValue={c?.folderPath || ''}
                    placeholder={`auto: ${t.keywords?.split(',')[0] || ''}`}
                    disabled={!d.canEdit}
                    onBlur={(e) => e.target.value !== (c?.folderPath || '') && save(t.id, { folderPath: e.target.value, linkId: folders.find((f) => f.path === e.target.value)?.linkId || null })}
                  />
                </td>
                <td className="py-2">
                  <select className={`${inputCls} text-xs py-1`} disabled={!d.canEdit} value={c?.responsibleStaffId || ''} onChange={(e) => save(t.id, { responsibleStaffId: e.target.value })}>
                    <option value="">Automático</option>
                    {staffBy(t.discipline).map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
