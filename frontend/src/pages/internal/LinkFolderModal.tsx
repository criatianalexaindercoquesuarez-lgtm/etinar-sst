import { useEffect, useState } from 'react';
import { ChevronRight, Folder, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { Modal, btnPrimary, btnSecondary, errMsg, inputCls, PURPOSE_LABELS } from './shared';

/**
 * Vincular una carpeta de OneDrive/SharePoint a la obra.
 * Se puede pegar el enlace de la carpeta general (ej. "DOCUMENTACION DE SEGURIDAD
 * OBRAS ETINAR") y navegar hasta la subcarpeta de esta obra, sin pedir un enlace por obra.
 */
export default function LinkFolderModal({ projectId, projectName, onClose, onDone }: { projectId: string; projectName: string; onClose: () => void; onDone: () => void }) {
  const [url, setUrl] = useState('');
  const [purpose, setPurpose] = useState('sst');
  const [label, setLabel] = useState('');
  const [subPath, setSubPath] = useState('');
  const [tree, setTree] = useState<any>(null);
  const [roots, setRoots] = useState<{ sst: string; mdt: string }>({ sst: '', mdt: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/internal/status').then((r) => setRoots({ sst: r.data.settings.rootLinkSst || '', mdt: r.data.settings.rootLinkMdt || '' })).catch(() => {});
  }, []);

  const isUrl = /^https?:\/\//i.test(url.trim());
  const src = () => (isUrl ? { url: url.trim() } : { path: url.trim() });

  async function explore(path: string) {
    setBusy(true);
    setErr('');
    try {
      const { data } = await api.post('/internal/drive/explore', { ...src(), subPath: path });
      setTree(data);
      setSubPath(path);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function link() {
    setBusy(true);
    setErr('');
    try {
      await api.post(`/internal/projects/${projectId}/links`, { ...src(), subPath: subPath || undefined, purpose, label: label || undefined });
      onDone();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const crumbs = subPath ? subPath.split('/') : [];

  return (
    <Modal title="Vincular carpeta de OneDrive / SharePoint" onClose={onClose}>
      <div className="space-y-3">
        {(roots.sst || roots.mdt) && (
          <div className="flex flex-wrap gap-2">
            {roots.sst && (
              <button className={btnSecondary} onClick={() => { setUrl(roots.sst); setPurpose('sst'); setTree(null); setSubPath(''); }}>
                Documentación de seguridad (obras)
              </button>
            )}
            {roots.mdt && (
              <button className={btnSecondary} onClick={() => { setUrl(roots.mdt); setPurpose('ministerio'); setTree(null); setSubPath(''); }}>
                Auditoría MDT / AM 196
              </button>
            )}
          </div>
        )}
        <label className="block text-xs text-steel-600">
          Enlace de la carpeta (OneDrive/SharePoint: clic derecho → "Copiar vínculo")
          <input className={inputCls} value={url} onChange={(e) => { setUrl(e.target.value); setTree(null); setSubPath(''); }} placeholder="https://etinar-my.sharepoint.com/…" />
        </label>

        <button className={btnSecondary} disabled={!url.trim() || busy} onClick={() => explore('')}>
          {busy && !tree ? <Loader2 size={14} className="animate-spin" /> : <Folder size={14} />} Ver subcarpetas y elegir la de esta obra
        </button>

        {tree && (
          <div className="border border-steel-200 rounded">
            <div className="px-3 py-2 bg-steel-50 text-xs flex flex-wrap items-center gap-1 border-b border-steel-200">
              <button className="font-semibold hover:text-safety-600" onClick={() => explore('')}>
                {crumbs.length ? 'Inicio' : tree.name}
              </button>
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1">
                  <ChevronRight size={12} />
                  <button className="hover:text-safety-600" onClick={() => explore(crumbs.slice(0, i + 1).join('/'))}>
                    {c}
                  </button>
                </span>
              ))}
            </div>
            <ul className="max-h-60 overflow-y-auto divide-y divide-steel-100">
              {tree.folders.map((f: any) => (
                <li key={f.name}>
                  <button className="w-full text-left px-3 py-1.5 text-sm flex items-center justify-between hover:bg-steel-50" onClick={() => explore(subPath ? `${subPath}/${f.name}` : f.name)}>
                    <span className="flex items-center gap-2">
                      <Folder size={14} className="text-safety-500" /> {f.name}
                    </span>
                    <span className="text-xs text-steel-400">{f.childCount} elem.</span>
                  </button>
                </li>
              ))}
              {tree.folders.length === 0 && <li className="px-3 py-2 text-xs text-steel-400">Sin subcarpetas ({tree.files} archivos)</li>}
            </ul>
            <div className="px-3 py-2 text-xs text-steel-600 border-t border-steel-200">
              Carpeta seleccionada: <b>{crumbs.length ? crumbs[crumbs.length - 1] : tree.name}</b> — se vinculará a <b>{projectName}</b> con todo su contenido.
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-steel-600">
            Uso de la carpeta
            <select className={inputCls} value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              {Object.entries(PURPOSE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-steel-600">
            Nombre visible (opcional)
            <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej. SST de la obra" />
          </label>
        </div>
        <p className="text-xs text-steel-400">Se leen solo los metadatos (no se copian archivos). Las cargas desde el sistema se guardan dentro de esta misma carpeta.</p>
        {err && <p className="text-sm text-rojo-600">{err}</p>}
        <button className={btnPrimary} onClick={link} disabled={!url.trim() || busy}>
          {busy ? 'Verificando acceso…' : 'Vincular carpeta'}
        </button>
      </div>
    </Modal>
  );
}
