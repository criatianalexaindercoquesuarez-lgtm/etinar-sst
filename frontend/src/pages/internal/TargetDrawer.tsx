import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Ban, RotateCcw, Upload, Link2, Search, CloudOff } from 'lucide-react';
import { api } from '../../lib/api';
import FileDropZone from '../../components/FileDropZone';
import {
  ActStatus,
  AmStatus,
  Drawer,
  EvidenceButtons,
  btnPrimary,
  btnSecondary,
  errMsg,
  fmtDate,
  fmtDateTime,
  inputCls,
  DISCIPLINE_LABELS,
  FREQ_LABELS,
  PURPOSE_LABELS,
} from './shared';

const SOURCE_LABEL: Record<string, string> = {
  auto: 'Reconocida en OneDrive',
  carga_sistema: 'Cargada desde el sistema',
  manual: 'Vinculada manualmente',
};

const ACTION_LABEL: Record<string, string> = {
  CAMBIO_ESTADO: 'Cambio de estado',
  EVIDENCIA_CARGADA: 'Evidencia cargada',
  EVIDENCIA_VINCULADA: 'Evidencia vinculada',
  EVIDENCIA_DESVINCULADA: 'Evidencia desvinculada',
  EVIDENCIA_SUBIDA_ONEDRIVE: 'Sincronizada con OneDrive',
  REVISION_VALIDAR: 'Validada por Coordinación SST',
  REVISION_OBSERVAR: 'Observada por Coordinación SST',
  REVISION_NO_APLICA: 'Marcada como no aplica',
  REVISION_REABRIR: 'Reabierta',
  NUEVA_EVIDENCIA_TRAS_OBSERVACION: 'Nueva evidencia tras observación',
  CONFIGURACION: 'Configuración actualizada',
};

/** Detalle de una actividad (targetType=activity) o de un requisito AM 196 (am196). */
export default function TargetDrawer({
  targetType,
  id,
  onClose,
  onChanged,
}: {
  targetType: 'activity' | 'am196';
  id: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [linkId, setLinkId] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [folders, setFolders] = useState<{ linkId: string; path: string }[]>([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [cfg, setCfg] = useState<any>({});

  const base = targetType === 'activity' ? `/internal/activities/${id}` : `/internal/am196/${id}`;

  function load() {
    api.get(base).then((r) => {
      setData(r.data);
      const sug = r.data.suggestedFolder;
      setLinkId(sug?.linkId || r.data.links?.[0]?.id || '');
      setFolderPath(sug?.folderPath || '');
      const it = r.data.item;
      if (it) setCfg({ responsibleStaffId: it.responsibleStaffId || '', responsibleName: it.responsibleName || '', folderPath: it.folderPath || '', linkId: it.linkId || '', notes: it.notes || '' });
      const pid = r.data.activity?.projectId || r.data.item?.projectId;
      if (pid) api.get(`/internal/projects/${pid}/folders`).then((f) => setFolders(f.data));
    });
  }
  useEffect(load, [id]);

  if (!data) return <Drawer title="Cargando…" onClose={onClose}><div /></Drawer>;

  const a = data.activity;
  const it = data.item;
  const row = a || it;
  const projectId = row.projectId;

  async function upload() {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('targetType', targetType);
      fd.append('targetId', id);
      if (linkId) fd.append('linkId', linkId);
      fd.append('folderPath', folderPath);
      if (comment) fd.append('comment', comment);
      const { data: r } = await api.post('/internal/upload', fd);
      setMsg(
        r.onedrive.synced
          ? { ok: true, text: `Archivo guardado en OneDrive: ${r.evidence.path}` }
          : { ok: true, text: `Archivo registrado. OneDrive no disponible (${r.onedrive.reason}); se subirá automáticamente en la próxima sincronización.` },
      );
      setFile(null);
      setComment('');
      load();
      onChanged?.();
    } catch (e) {
      setMsg({ ok: false, text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  async function review(action: string) {
    let c = '';
    if (action === 'observar' || action === 'no_aplica') {
      c = prompt(action === 'observar' ? 'Observación (qué debe corregirse):' : 'Motivo por el que no aplica:') || '';
      if (action === 'observar' && !c.trim()) return;
    }
    try {
      await api.post(`${base}/review`, { action, comment: c });
      load();
      onChanged?.();
    } catch (e) {
      alert(errMsg(e));
    }
  }

  async function doSearch() {
    const r = await api.get(`/internal/projects/${projectId}/files`, { params: { q: search } });
    setResults(r.data);
  }

  async function linkFile(rowId: string) {
    try {
      await api.post(`${base}/evidence`, { driveItemRowId: rowId });
      setResults([]);
      setSearch('');
      load();
      onChanged?.();
    } catch (e) {
      alert(errMsg(e));
    }
  }

  async function unlink(evId: string) {
    if (!confirm('¿Desvincular esta evidencia? El archivo en OneDrive no se modifica.')) return;
    try {
      await api.delete(`/internal/evidence/${evId}`);
      load();
      onChanged?.();
    } catch (e) {
      alert(errMsg(e));
    }
  }

  async function saveCfg() {
    try {
      await api.put(`/internal/am196/${id}`, cfg);
      load();
      onChanged?.();
      setMsg({ ok: true, text: 'Configuración guardada y matriz recalculada.' });
    } catch (e) {
      setMsg({ ok: false, text: errMsg(e) });
    }
  }

  const title = a ? a.template.name : `${it.requirement.code} · AM 196`;
  const subtitle = a ? (
    <span>
      {a.project?.code} · {DISCIPLINE_LABELS[a.template.discipline]} · {FREQ_LABELS[a.template.frequency]} · Período {a.periodKey} ({fmtDate(a.periodStart)} – {fmtDate(a.periodEnd)})
    </span>
  ) : (
    <span>
      {it.project?.code} · {it.requirement.section}
    </span>
  );

  return (
    <Drawer title={title} subtitle={subtitle} onClose={onClose} wide>
      {/* Estado */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Info label="Estado">{a ? <ActStatus status={a.status} late={a.late} /> : <AmStatus status={it.status} />}</Info>
        {a ? (
          <>
            <Info label="Fecha límite">{fmtDate(a.dueDate)}</Info>
            <Info label="Responsable">{a.staff?.fullName || 'Sin asignar'}</Info>
            <Info label="Evidencias">{a.evidenceCount} / mín. {a.template.minEvidence}</Info>
          </>
        ) : (
          <>
            <Info label="Última actualización">{fmtDate(it.lastUpdateDate)}</Info>
            <Info label="Vigente hasta">{it.requirement.validityDays ? fmtDate(it.expiresAt) : 'No vence'}</Info>
            <Info label="Evidencias">{it.evidenceCount}</Info>
          </>
        )}
      </div>
      {it && (
        <div className="text-sm text-steel-700 bg-steel-50 border border-steel-200 rounded p-3">
          <div className="font-medium text-steel-900">{it.requirement.description}</div>
          <div className="text-xs text-steel-600 mt-1">Base legal: {it.requirement.legalRef || '—'} · Verificación: {it.requirement.evidenceType === 'in_situ' ? 'en campo (evidencia fotográfica / registro)' : 'documental'}</div>
        </div>
      )}
      {row.review && (
        <div className={`text-sm rounded p-3 border ${row.review === 'observada' ? 'bg-safety-100 border-safety-400 text-safety-600' : 'bg-steel-50 border-steel-200 text-steel-700'}`}>
          <b>Revisión:</b> {row.review} {row.reviewComment ? `— ${row.reviewComment}` : ''} <span className="text-xs">({row.reviewedBy}, {fmtDateTime(row.reviewedAt)})</span>
        </div>
      )}

      {/* Revisión de Coordinación SST */}
      {data.canEdit && (
        <div className="flex flex-wrap gap-2">
          <button className={btnSecondary} onClick={() => review('validar')}>
            <CheckCircle2 size={15} className="text-verde-600" /> Validar
          </button>
          <button className={btnSecondary} onClick={() => review('observar')}>
            <AlertTriangle size={15} className="text-safety-500" /> Observar
          </button>
          <button className={btnSecondary} onClick={() => review('no_aplica')}>
            <Ban size={15} /> No aplica
          </button>
          {row.review && (
            <button className={btnSecondary} onClick={() => review('reabrir')}>
              <RotateCcw size={15} /> Quitar revisión
            </button>
          )}
        </div>
      )}

      {/* Evidencias */}
      <div>
        <h3 className="font-semibold text-steel-900 mb-2">Evidencias y trazabilidad</h3>
        {data.evidence.length === 0 ? (
          <p className="text-sm text-steel-400">Sin evidencias. Cárgala abajo o colócala en la carpeta de OneDrive de la obra: el sistema la reconoce automáticamente.</p>
        ) : (
          <ul className="divide-y divide-steel-100 border border-steel-200 rounded">
            {data.evidence.map((e: any) => (
              <li key={e.id} className="px-3 py-2 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-steel-900 truncate flex items-center gap-1.5">
                    {e.syncStatus === 'pendiente_onedrive' && <CloudOff size={14} className="text-amarillo-600 shrink-0" />}
                    {e.fileName}
                  </div>
                  <div className="text-xs text-steel-600 truncate">
                    {e.path} · {SOURCE_LABEL[e.source] || e.source} · {fmtDateTime(e.fileDate || e.createdAt)}
                    {e.addedBy ? ` · ${e.addedBy}` : ''}
                    {e.sha256 ? ` · SHA-256 ${e.sha256.slice(0, 10)}…` : ''}
                  </div>
                </div>
                <div className="flex items-center shrink-0">
                  <EvidenceButtons id={e.id} webUrl={e.webUrl} />
                  {data.canEdit && e.source !== 'auto' && (
                    <button className="text-xs text-rojo-600 hover:underline ml-1" onClick={() => unlink(e.id)}>
                      Desvincular
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Carga */}
      {data.canUpload && (
        <div className="border border-steel-200 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-steel-900 flex items-center gap-2">
            <Upload size={16} /> Cargar evidencia (se guarda en la carpeta original de OneDrive)
          </h3>
          {data.links.length === 0 ? (
            <p className="text-sm text-rojo-600">La obra no tiene carpeta de OneDrive vinculada.</p>
          ) : (
            <>
              <FileDropZone file={file} onChange={setFile} hint="Cualquier archivo: PDF, Excel, Word, fotos… · máx. 20MB" />
              <div className="grid md:grid-cols-2 gap-3">
                <label className="text-xs text-steel-600">
                  Carpeta vinculada
                  <select className={inputCls} value={linkId} onChange={(e) => setLinkId(e.target.value)}>
                    {data.links.map((l: any) => (
                      <option key={l.id} value={l.id}>
                        {l.label || l.folderName || l.sourceUrl} ({PURPOSE_LABELS[l.purpose] || l.purpose})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-steel-600">
                  Subcarpeta destino
                  <input className={inputCls} list={`folders-${id}`} value={folderPath} onChange={(e) => setFolderPath(e.target.value)} placeholder="(raíz de la carpeta vinculada)" />
                  <datalist id={`folders-${id}`}>
                    {folders.filter((f) => f.linkId === linkId).map((f) => (
                      <option key={f.path} value={f.path} />
                    ))}
                  </datalist>
                </label>
              </div>
              {data.suggestedFolder?.reason && <p className="text-xs text-steel-400">Sugerencia: {data.suggestedFolder.reason}. Si la subcarpeta no existe, se crea; nunca se sobrescriben archivos.</p>}
              <input className={inputCls} placeholder="Comentario (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} />
              <button className={btnPrimary} disabled={!file || busy} onClick={upload}>
                {busy ? 'Subiendo…' : 'Subir evidencia'}
              </button>
            </>
          )}
          {msg && <p className={`text-sm ${msg.ok ? 'text-verde-600' : 'text-rojo-600'}`}>{msg.text}</p>}
        </div>
      )}

      {/* Vincular archivo existente */}
      {data.canUpload && data.links.length > 0 && (
        <div className="border border-steel-200 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-steel-900 flex items-center gap-2">
            <Link2 size={16} /> Vincular un archivo que ya está en OneDrive
          </h3>
          <div className="flex gap-2">
            <input className={inputCls} placeholder="Buscar por nombre o carpeta…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()} />
            <button className={btnSecondary} onClick={doSearch}>
              <Search size={15} />
            </button>
          </div>
          {results.length > 0 && (
            <ul className="max-h-56 overflow-y-auto divide-y divide-steel-100 border border-steel-200 rounded">
              {results.map((f) => (
                <li key={f.id} className="px-3 py-1.5 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate" title={f.path}>
                    {f.path} <span className="text-xs text-steel-400">{fmtDate(f.fileModifiedAt)}</span>
                  </span>
                  <button className="text-xs text-safety-600 font-semibold hover:underline shrink-0" onClick={() => linkFile(f.id)}>
                    Vincular
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Configuración del requisito AM 196 */}
      {it && data.canEdit && (
        <div className="border border-steel-200 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-steel-900">Responsable y ubicación en OneDrive</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-xs text-steel-600">
              Responsable de mantenerlo actualizado
              <select className={inputCls} value={cfg.responsibleStaffId} onChange={(e) => setCfg({ ...cfg, responsibleStaffId: e.target.value })}>
                <option value="">— Otra persona (escribir abajo) —</option>
                {(data.staff || []).map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({DISCIPLINE_LABELS[s.discipline]})
                  </option>
                ))}
              </select>
              {!cfg.responsibleStaffId && (
                <input className={`${inputCls} mt-1`} value={cfg.responsibleName} onChange={(e) => setCfg({ ...cfg, responsibleName: e.target.value })} placeholder="Ej. Jefe de obra, Talento Humano…" />
              )}
            </label>
            <label className="text-xs text-steel-600">
              Carpeta exacta de la evidencia (opcional)
              <input className={inputCls} list={`amf-${id}`} value={cfg.folderPath} onChange={(e) => setCfg({ ...cfg, folderPath: e.target.value })} placeholder="Si se deja vacío, se reconoce por palabras clave" />
              <datalist id={`amf-${id}`}>
                {folders.map((f) => (
                  <option key={f.linkId + f.path} value={f.path} />
                ))}
              </datalist>
            </label>
          </div>
          <textarea className={inputCls} rows={2} placeholder="Notas" value={cfg.notes} onChange={(e) => setCfg({ ...cfg, notes: e.target.value })} />
          <button className={btnSecondary} onClick={saveCfg}>
            Guardar
          </button>
        </div>
      )}

      {/* Historial */}
      <div>
        <h3 className="font-semibold text-steel-900 mb-2">Historial de seguimiento</h3>
        {data.history.length === 0 ? (
          <p className="text-sm text-steel-400">Sin movimientos.</p>
        ) : (
          <ol className="relative border-l border-steel-200 ml-2 space-y-3">
            {data.history.map((h: any) => (
              <li key={h.id} className="ml-4 text-sm">
                <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-steel-200 border-2 border-white" />
                <div className="text-steel-900">
                  <b>{ACTION_LABEL[h.action] || h.action}</b>
                  {h.fromStatus || h.toStatus ? ` · ${h.fromStatus || '—'} → ${h.toStatus || '—'}` : ''}
                </div>
                {h.detail && <div className="text-xs text-steel-600">{h.detail}</div>}
                <div className="text-xs text-steel-400">
                  {fmtDateTime(h.createdAt)} · {h.actor}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Drawer>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-steel-50 border border-steel-200 rounded p-2.5">
      <div className="text-[11px] uppercase tracking-wide text-steel-400 font-semibold">{label}</div>
      <div className="mt-1 text-steel-900">{children}</div>
    </div>
  );
}
