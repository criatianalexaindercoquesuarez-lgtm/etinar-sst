import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Eye, Download, Building2 } from 'lucide-react';
import { api } from '../lib/api';
import { StatusBadge } from '../components/Badges';
import DocumentViewerModal from '../components/DocumentViewerModal';

interface PendingDoc {
  id: string;
  status: string;
  documentType: { name: string };
  folder: { code: string; name: string };
  contractor: { legalName: string };
  project: { id: string; code: string; name: string };
  versions: {
    id: string;
    versionNumber: number;
    fileName: string;
    uploadedAt: string;
  }[];
  createdAt: string;
}

export default function Review() {
  const [docs, setDocs] = useState<PendingDoc[]>([]);
  const [acting, setActing] = useState<PendingDoc | null>(null);
  const [viewing, setViewing] = useState<{ versionId: string; fileName: string } | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState('');

  function load() {
    api.get('/documents/pending/review').then((r) => setDocs(r.data));
  }
  useEffect(load, []);

  // Proyectos únicos presentes en la lista actual, para el filtro.
  const projectOptions = useMemo(() => {
    const map = new Map<string, { id: string; code: string; name: string }>();
    docs.forEach((d) => {
      if (d.project) map.set(d.project.id, d.project);
    });
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [docs]);

  const filteredDocs = projectFilter
    ? docs.filter((d) => d.project?.id === projectFilter)
    : docs;

  async function handleDownload(versionId: string, fileName: string) {
    setDownloadingId(versionId);
    try {
      const res = await api.get(`/documents/version/${versionId}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('No se pudo descargar el archivo.');
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-black text-steel-900 tracking-tight">
          Revisión Documental
        </h1>
        <p className="text-steel-600 text-sm mt-1">
          Documentos pendientes de aprobación por el equipo SST
        </p>
      </header>

      {projectOptions.length > 1 && (
        <div className="bg-white border border-steel-200 rounded-lg p-4 flex items-center gap-3">
          <Building2 size={16} className="text-steel-500 shrink-0" />
          <label className="text-xs font-semibold text-steel-600 uppercase tracking-wide shrink-0">
            Filtrar por proyecto
          </label>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="flex-1 max-w-xs border border-steel-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-safety-500"
          >
            <option value="">Todos los proyectos ({docs.length})</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name} ({docs.filter((d) => d.project?.id === p.id).length})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-3">
        {filteredDocs.map((d) => {
          const latest = d.versions[d.versions.length - 1];
          return (
            <div
              key={d.id}
              className="bg-white border border-steel-200 rounded-lg p-5 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-semibold text-steel-900">{d.documentType.name}</span>
                  <StatusBadge status={d.status} />
                  {d.project && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-steel-900 text-white px-2 py-0.5 rounded">
                      <Building2 size={10} /> {d.project.code}
                    </span>
                  )}
                </div>
                <p className="text-sm text-steel-600">
                  {d.contractor.legalName} · {d.project?.name} · Carpeta {d.folder.code} {d.folder.name}
                </p>
                {latest && (
                  <p className="text-xs text-steel-400 mt-1">
                    Archivo: {latest.fileName} · v{latest.versionNumber} · cargado{' '}
                    {new Date(latest.uploadedAt).toLocaleString('es-EC')}
                  </p>
                )}
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {latest && (
                  <>
                    <button
                      onClick={() => setViewing({ versionId: latest.id, fileName: latest.fileName })}
                      className="flex items-center gap-1.5 border border-steel-200 hover:border-steel-400 text-steel-600 text-sm font-semibold px-3 py-2 rounded transition-colors"
                    >
                      <Eye size={15} /> Ver
                    </button>
                    <button
                      onClick={() => handleDownload(latest.id, latest.fileName)}
                      disabled={downloadingId === latest.id}
                      title="Descargar archivo original"
                      className="flex items-center gap-1.5 border border-steel-200 hover:border-steel-400 text-steel-600 text-sm font-semibold px-3 py-2 rounded transition-colors disabled:opacity-60"
                    >
                      <Download size={15} /> {downloadingId === latest.id ? '...' : 'Descargar'}
                    </button>
                  </>
                )}
                <button
                  onClick={() => setActing(d)}
                  className="bg-steel-900 hover:bg-steel-800 text-white text-sm font-semibold px-4 py-2 rounded transition-colors"
                >
                  Revisar
                </button>
              </div>
            </div>
          );
        })}
        {filteredDocs.length === 0 && docs.length > 0 && (
          <div className="bg-white border border-dashed border-steel-200 rounded-lg p-10 text-center text-steel-400 text-sm">
            No hay documentos pendientes para el proyecto seleccionado.
          </div>
        )}
        {docs.length === 0 && (
          <div className="bg-white border border-dashed border-steel-200 rounded-lg p-10 text-center text-steel-400 text-sm">
            No hay documentos pendientes de revisión. 🎉
          </div>
        )}
      </div>

      {viewing && (
        <DocumentViewerModal
          versionId={viewing.versionId}
          fileName={viewing.fileName}
          onClose={() => setViewing(null)}
        />
      )}

      {acting && (
        <ReviewModal
          doc={acting}
          onClose={() => setActing(null)}
          onDone={() => {
            load();
            setActing(null);
          }}
        />
      )}
    </div>
  );
}

function ReviewModal({
  doc,
  onClose,
  onDone,
}: {
  doc: PendingDoc;
  onClose: () => void;
  onDone: () => void;
}) {
  const [comments, setComments] = useState('');
  const [saving, setSaving] = useState(false);

  async function act(action: 'aprobar' | 'observar' | 'rechazar') {
    setSaving(true);
    await api.post(`/documents/${doc.id}/review`, { action, comments });
    setSaving(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-steel-950/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6 space-y-4">
        <h2 className="font-semibold text-steel-900">{doc.documentType.name}</h2>
        <p className="text-sm text-steel-600">
          {doc.contractor.legalName} · {doc.project?.code}
        </p>

        <div>
          <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
            Comentarios / recomendación para el contratista
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            placeholder="Opcional para aprobación. Recomendado para observación o rechazo: explica qué debe corregir el contratista."
            className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
          />
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2">
          <button
            disabled={saving}
            onClick={() => act('aprobar')}
            className="flex flex-col items-center gap-1 bg-verde-100 hover:opacity-80 text-verde-600 rounded py-3 text-xs font-semibold transition-opacity disabled:opacity-50"
          >
            <CheckCircle2 size={18} /> Aprobar
          </button>
          <button
            disabled={saving}
            onClick={() => act('observar')}
            className="flex flex-col items-center gap-1 bg-amarillo-100 hover:opacity-80 text-amarillo-600 rounded py-3 text-xs font-semibold transition-opacity disabled:opacity-50"
          >
            <AlertTriangle size={18} /> Observar
          </button>
          <button
            disabled={saving}
            onClick={() => act('rechazar')}
            className="flex flex-col items-center gap-1 bg-rojo-100 hover:opacity-80 text-rojo-600 rounded py-3 text-xs font-semibold transition-opacity disabled:opacity-50"
          >
            <XCircle size={18} /> Rechazar
          </button>
        </div>

        <button onClick={onClose} className="w-full text-sm text-steel-500 pt-1">
          Cancelar
        </button>
      </div>
    </div>
  );
}
