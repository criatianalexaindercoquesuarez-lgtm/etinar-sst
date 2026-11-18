import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Send, Download, Save, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Card, Modal, btnPrimary, btnSecondary, downloadBlob, errMsg, fmtDateTime, inputCls, DISCIPLINE_LABELS, FREQ_LABELS } from './shared';

export default function InternalSettings() {
  const { user } = useAuth();
  const canEdit = user && ['admin', 'coordinador_sst'].includes(user.role);
  const [status, setStatus] = useState<any>(null);
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState('');
  const [weekKey, setWeekKey] = useState('');
  const [monthKey, setMonthKey] = useState('');
  const [section, setSection] = useState<'reportes' | 'actividades' | 'am196'>('reportes');

  function load() {
    api.get('/internal/status').then((r) => {
      setStatus(r.data);
      setCfg(r.data.settings);
    });
    api.get('/internal/reports/history').then((r) => setHistory(r.data));
  }
  useEffect(load, []);

  async function save() {
    try {
      await api.put('/internal/settings', cfg);
      setMsg('Configuración guardada.');
      load();
    } catch (e) {
      setMsg(errMsg(e));
    }
  }

  async function send(type: string, key: string) {
    setSending(type);
    try {
      const { data } = await api.post('/internal/reports/send', { type, key: key || undefined });
      setMsg(`Reporte ${type} ${data.period} → ${data.recipients} (${data.status}).`);
      load();
    } catch (e) {
      setMsg(errMsg(e));
    } finally {
      setSending('');
    }
  }

  async function preview(type: string, key: string) {
    const res = await api.get('/internal/reports/download', { params: { type, key: key || undefined, format: 'html' }, responseType: 'text' });
    const w = window.open('', '_blank');
    w?.document.write(res.data);
  }

  if (!status) return <p className="text-steel-400">Cargando…</p>;
  const channelLabel: Record<string, string> = { smtp: 'SMTP', graph: `Microsoft 365 (${status.mailSender})`, simulado: 'Simulado: se registra pero no se envía' };

  return (
    <div className="space-y-6">
      <nav className="flex gap-1">
        {[
          ['reportes', 'Reportes y conexión'],
          ['actividades', 'Catálogo de actividades'],
          ['am196', 'Requisitos AM 196'],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setSection(k as any)} className={`px-3 py-1.5 text-sm rounded ${section === k ? 'bg-steel-900 text-white' : 'text-steel-700 hover:bg-steel-100'}`}>
            {l}
          </button>
        ))}
      </nav>

      {section === 'reportes' && (
        <>
          <Card title="Conexión con Microsoft 365">
            <ul className="text-sm space-y-2">
              <Check ok={status.azureConfigured} label="Credenciales de Azure AD (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)" />
              <Check ok={status.siteConfigured} label="Sitio de SharePoint (SHAREPOINT_SITE_ID) — opcional si vinculas carpetas por enlace" optional />
              <Check ok={status.mailChannel !== 'simulado'} label={`Envío de correo: ${channelLabel[status.mailChannel]}`} />
              <Check ok={status.linksError === 0 && status.links > 0} label={`Carpetas vinculadas: ${status.linksOk} verificadas de ${status.links}${status.linksError ? `, ${status.linksError} con error` : ''}${status.linksUnverified ? `, ${status.linksUnverified} sin verificar` : ''}`} />
              <Check ok={status.pendingUploads === 0} label={`Cargas pendientes de subir a OneDrive: ${status.pendingUploads}`} />
            </ul>
            {!status.azureConfigured && (
              <div className="mt-4 text-xs text-steel-600 bg-steel-50 border border-steel-200 rounded p-3 space-y-1">
                <b>Para activar la lectura y escritura en OneDrive:</b>
                <div>1. Azure Portal → Microsoft Entra ID → Registros de aplicaciones → Nuevo registro ("SST ETINAR").</div>
                <div>2. Permisos de API → Microsoft Graph → Permisos de aplicación: Sites.ReadWrite.All, Files.ReadWrite.All y Mail.Send (para enviar los reportes). Conceder consentimiento de administrador.</div>
                <div>3. Certificados y secretos → Nuevo secreto de cliente.</div>
                <div>4. En Render (etinar-sst-backend → Environment): AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET y MAIL_SENDER (buzón remitente, ej. sst@etinar.com).</div>
              </div>
            )}
          </Card>

          <Card title="Carpetas generales de OneDrive">
            <p className="text-xs text-steel-600 mb-3">
              Guarda aquí los enlaces de las carpetas generales. Al vincular una obra, solo eliges su subcarpeta: no hace falta un enlace por obra.
            </p>
            <div className="space-y-3">
              <label className="block text-xs text-steel-600">
                Documentación de seguridad de obras (contiene una carpeta por obra)
                <input className={inputCls} disabled={!canEdit} value={cfg.rootLinkSst || ''} onChange={(e) => setCfg({ ...cfg, rootLinkSst: e.target.value })} placeholder="https://etinar-my.sharepoint.com/…" />
              </label>
              <label className="block text-xs text-steel-600">
                Auditoría MDT / AM 196
                <input className={inputCls} disabled={!canEdit} value={cfg.rootLinkMdt || ''} onChange={(e) => setCfg({ ...cfg, rootLinkMdt: e.target.value })} placeholder="https://etinar-my.sharepoint.com/…" />
              </label>
              {canEdit && (
                <button className={btnPrimary} onClick={save}>
                  <Save size={15} /> Guardar enlaces
                </button>
              )}
            </div>
          </Card>

          <Card title="Reportes automáticos por correo">
            <div className="space-y-4">
              <label className="block text-xs text-steel-600">
                Destinatarios (separados por coma)
                <input className={inputCls} disabled={!canEdit} value={cfg.reportRecipients || ''} onChange={(e) => setCfg({ ...cfg, reportRecipients: e.target.value })} />
              </label>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border border-steel-200 rounded p-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" disabled={!canEdit} checked={cfg.weeklyEnabled === 'true'} onChange={(e) => setCfg({ ...cfg, weeklyEnabled: String(e.target.checked) })} />
                    Reporte semanal
                  </label>
                  <label className="block text-xs text-steel-600">
                    Se envía el día (sobre la semana lunes–domingo anterior)
                    <select className={inputCls} disabled={!canEdit} value={cfg.weeklyDay} onChange={(e) => setCfg({ ...cfg, weeklyDay: e.target.value })}>
                      {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map((d, i) => (
                        <option key={d} value={String(i + 1)}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-xs text-steel-400">Ejecutadas, pendientes, incumplimientos y novedades por obra. Adjunta Excel.</p>
                </div>
                <div className="border border-steel-200 rounded p-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" disabled={!canEdit} checked={cfg.monthlyEnabled === 'true'} onChange={(e) => setCfg({ ...cfg, monthlyEnabled: String(e.target.checked) })} />
                    Reporte mensual
                  </label>
                  <label className="block text-xs text-steel-600">
                    Día del mes de envío (sobre el mes anterior)
                    <input type="number" min={1} max={28} className={inputCls} disabled={!canEdit} value={cfg.monthlyDay} onChange={(e) => setCfg({ ...cfg, monthlyDay: e.target.value })} />
                  </label>
                  <p className="text-xs text-steel-400">% de cumplimiento, resumen de gestión, pendientes acumulados, estado por asistente y AM 196. Adjunta Excel y PDF.</p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" disabled={!canEdit} checked={cfg.alertDigest === 'true'} onChange={(e) => setCfg({ ...cfg, alertDigest: String(e.target.checked) })} />
                Correo diario con alertas nuevas (actividades no ejecutadas, AM 196 vencido o por actualizar)
              </label>
              {canEdit && (
                <button className={btnPrimary} onClick={save}>
                  <Save size={15} /> Guardar configuración
                </button>
              )}
            </div>
          </Card>

          <Card title="Generar un reporte ahora">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Semanal</div>
                <input type="date" className={inputCls} value={weekKey} onChange={(e) => setWeekKey(e.target.value)} title="Cualquier día de la semana a reportar (vacío = semana anterior)" />
                <div className="flex flex-wrap gap-2">
                  <button className={btnSecondary} onClick={() => preview('semanal', weekKey)}>
                    Vista previa
                  </button>
                  <button className={btnSecondary} onClick={() => downloadBlob('/internal/reports/download', { type: 'semanal', key: weekKey, format: 'xlsx' }, 'reporte-semanal.xlsx')}>
                    <Download size={14} /> Excel
                  </button>
                  {canEdit && (
                    <button className={btnSecondary} disabled={sending === 'semanal'} onClick={() => send('semanal', weekKey)}>
                      <Send size={14} /> Enviar
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Mensual</div>
                <input type="month" className={inputCls} value={monthKey} onChange={(e) => setMonthKey(e.target.value)} title="Vacío = mes anterior" />
                <div className="flex flex-wrap gap-2">
                  <button className={btnSecondary} onClick={() => preview('mensual', monthKey)}>
                    Vista previa
                  </button>
                  <button className={btnSecondary} onClick={() => downloadBlob('/internal/reports/download', { type: 'mensual', key: monthKey, format: 'xlsx' }, 'reporte-mensual.xlsx')}>
                    <Download size={14} /> Excel
                  </button>
                  <button className={btnSecondary} onClick={() => downloadBlob('/internal/reports/download', { type: 'mensual', key: monthKey, format: 'pdf' }, 'reporte-mensual.pdf')}>
                    <Download size={14} /> PDF
                  </button>
                  {canEdit && (
                    <button className={btnSecondary} disabled={sending === 'mensual'} onClick={() => send('mensual', monthKey)}>
                      <Send size={14} /> Enviar
                    </button>
                  )}
                </div>
              </div>
            </div>
            {msg && <p className="text-sm text-steel-700 mt-3">{msg}</p>}
          </Card>

          <Card title="Historial de reportes enviados">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-steel-600">
                <tr className="border-b border-steel-200">
                  <th className="text-left py-2">Fecha</th>
                  <th className="text-left py-2">Tipo</th>
                  <th className="text-left py-2">Período</th>
                  <th className="text-left py-2">Destinatarios</th>
                  <th className="text-left py-2">Origen</th>
                  <th className="text-left py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-steel-100">
                    <td className="py-1.5 text-xs">{fmtDateTime(h.createdAt)}</td>
                    <td className="py-1.5 capitalize">{h.type}</td>
                    <td className="py-1.5">{h.periodKey}</td>
                    <td className="py-1.5 text-xs">{h.recipients}</td>
                    <td className="py-1.5 text-xs">{h.trigger === 'auto' ? 'Automático' : `Manual (${h.triggeredBy})`}</td>
                    <td className={`py-1.5 text-xs font-semibold ${h.status === 'enviado' ? 'text-verde-600' : h.status === 'simulado' ? 'text-amarillo-600' : 'text-rojo-600'}`}>{h.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {history.length === 0 && <p className="text-sm text-steel-400 py-4 text-center">Aún no se han enviado reportes.</p>}
          </Card>
        </>
      )}

      {section === 'actividades' && <TemplatesEditor canEdit={!!canEdit} />}
      {section === 'am196' && <RequirementsEditor canEdit={!!canEdit} />}
    </div>
  );
}

function Check({ ok, label, optional }: { ok: boolean; label: string; optional?: boolean }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? <CheckCircle2 size={16} className="text-verde-600 mt-0.5 shrink-0" /> : <XCircle size={16} className={`${optional ? 'text-steel-400' : 'text-rojo-600'} mt-0.5 shrink-0`} />}
      <span>{label}</span>
    </li>
  );
}

const EMPTY_T = { code: '', name: '', discipline: 'sst', frequency: 'semanal', graceDays: 2, minEvidence: 1, keywords: '', defaultFolder: '', active: true };

function TemplatesEditor({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const [err, setErr] = useState('');
  function load() {
    api.get('/internal/templates').then((r) => setRows(r.data));
  }
  useEffect(load, []);
  async function save() {
    setErr('');
    try {
      if (edit.id) await api.put(`/internal/templates/${edit.id}`, edit);
      else await api.post('/internal/templates', edit);
      setEdit(null);
      load();
    } catch (e) {
      setErr(errMsg(e));
    }
  }
  return (
    <Card title="Catálogo de actividades por rol" actions={canEdit && <button className={btnPrimary} onClick={() => setEdit({ ...EMPTY_T })}><Plus size={15} /> Nueva actividad</button>}>
      <p className="text-xs text-steel-600 mb-3">
        Las palabras clave reconocen la evidencia en OneDrive (separadas por coma; usa "+" para exigir varias palabras a la vez, ej. "acta+comite"). Plazo = días después del cierre del período para entregar.
      </p>
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-steel-600">
          <tr className="border-b border-steel-200">
            <th className="text-left py-2">Código</th>
            <th className="text-left py-2">Actividad</th>
            <th className="text-left py-2">Rol</th>
            <th className="text-left py-2">Frecuencia</th>
            <th className="text-center py-2">Plazo</th>
            <th className="text-left py-2">Palabras clave</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className={`border-b border-steel-100 ${t.active ? '' : 'opacity-40'} ${canEdit ? 'cursor-pointer hover:bg-steel-50' : ''}`} onClick={() => canEdit && setEdit({ ...t })}>
              <td className="py-1.5 font-mono text-xs">{t.code}</td>
              <td className="py-1.5">{t.name}</td>
              <td className="py-1.5 text-xs">{DISCIPLINE_LABELS[t.discipline]}</td>
              <td className="py-1.5 text-xs">{FREQ_LABELS[t.frequency]}</td>
              <td className="py-1.5 text-center text-xs">{t.graceDays} d</td>
              <td className="py-1.5 text-xs text-steel-600">{t.keywords}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {edit && (
        <Modal title={edit.id ? `Editar ${edit.code}` : 'Nueva actividad'} onClose={() => setEdit(null)}>
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <input className={inputCls} placeholder="Código" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} />
              <select className={`${inputCls} col-span-2`} value={edit.discipline} onChange={(e) => setEdit({ ...edit, discipline: e.target.value })}>
                {Object.entries(DISCIPLINE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <input className={inputCls} placeholder="Nombre de la actividad" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs text-steel-600">
                Frecuencia
                <select className={inputCls} value={edit.frequency} onChange={(e) => setEdit({ ...edit, frequency: e.target.value })}>
                  {Object.entries(FREQ_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-steel-600">
                Plazo (días)
                <input type="number" className={inputCls} value={edit.graceDays} onChange={(e) => setEdit({ ...edit, graceDays: Number(e.target.value) })} />
              </label>
              <label className="text-xs text-steel-600">
                Mín. evidencias
                <input type="number" className={inputCls} value={edit.minEvidence} onChange={(e) => setEdit({ ...edit, minEvidence: Number(e.target.value) })} />
              </label>
            </div>
            <input className={inputCls} placeholder="Palabras clave" value={edit.keywords || ''} onChange={(e) => setEdit({ ...edit, keywords: e.target.value })} />
            <input className={inputCls} placeholder="Subcarpeta sugerida para cargas (ej. SST/Inspecciones)" value={edit.defaultFolder || ''} onChange={(e) => setEdit({ ...edit, defaultFolder: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Activa
            </label>
            {err && <p className="text-sm text-rojo-600">{err}</p>}
            <button className={btnPrimary} onClick={save}>
              Guardar
            </button>
          </div>
        </Modal>
      )}
    </Card>
  );
}

function RequirementsEditor({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  function load() {
    api.get('/internal/am196/requirements').then((r) => setRows(r.data));
  }
  useEffect(load, []);
  async function save() {
    try {
      await api.put(`/internal/am196/requirements/${edit.id}`, edit);
      setEdit(null);
      load();
    } catch (e) {
      alert(errMsg(e));
    }
  }
  return (
    <Card title="Requisitos AM MDT-2024-196 (Anexo 1)">
      <p className="text-xs text-steel-600 mb-3">
        Basado en la Lista de verificación SST (Anexo 1). La vigencia es un control interno: cuántos días después de la última actualización el sistema pide renovar la evidencia (vacío = no vence). Verifica el texto con la versión oficial vigente del Ministerio del Trabajo.
      </p>
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-steel-600">
          <tr className="border-b border-steel-200">
            <th className="text-left py-2">Código</th>
            <th className="text-left py-2">Requisito</th>
            <th className="text-center py-2">Vigencia</th>
            <th className="text-left py-2">Palabras clave</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={`border-b border-steel-100 ${r.active ? '' : 'opacity-40'} ${canEdit ? 'cursor-pointer hover:bg-steel-50' : ''}`} onClick={() => canEdit && setEdit({ ...r })}>
              <td className="py-1.5 font-mono text-xs">{r.code}</td>
              <td className="py-1.5">
                {r.description}
                <div className="text-xs text-steel-400">{r.legalRef}</div>
              </td>
              <td className="py-1.5 text-center text-xs">{r.validityDays ? `${r.validityDays} d` : 'No vence'}</td>
              <td className="py-1.5 text-xs text-steel-600">{r.keywords}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {edit && (
        <Modal title={`Editar ${edit.code}`} onClose={() => setEdit(null)}>
          <div className="space-y-2">
            <textarea className={inputCls} rows={3} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            <input className={inputCls} placeholder="Base legal" value={edit.legalRef || ''} onChange={(e) => setEdit({ ...edit, legalRef: e.target.value })} />
            <label className="text-xs text-steel-600 block">
              Vigencia en días (vacío = no vence)
              <input type="number" className={inputCls} value={edit.validityDays ?? ''} onChange={(e) => setEdit({ ...edit, validityDays: e.target.value === '' ? null : Number(e.target.value) })} />
            </label>
            <input className={inputCls} placeholder="Palabras clave" value={edit.keywords || ''} onChange={(e) => setEdit({ ...edit, keywords: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Activo
            </label>
            <button className={btnPrimary} onClick={save}>
              Guardar
            </button>
          </div>
        </Modal>
      )}
    </Card>
  );
}
