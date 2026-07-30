import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Eye } from 'lucide-react';
import { api } from '../lib/api';
import { StatusBadge } from '../components/Badges';
import DocumentViewerModal from '../components/DocumentViewerModal';

interface PendingDoc {
  id: string;
  status: string;
  documentType: { name: string };
  folder: { code: string; name: string };
  contractor: { legalName: string };
  project: { code: string; name: string };
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

  function load() {
    api.get('/documents/pending/review').then((r) => setDocs(r.data));
  }
  useEffect(load, []);

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

      <div className="space-y-3">
        {docs.map((d) => {
          const latest = d.versions[d.versions.length - 1];
          return (
            <div
              key={d.id}
              className="bg-white border border-steel-200 rounded-lg p-5 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-steel-900">{d.documentType.name}</span>
                  <StatusBadge status={d.status} />
                </div>
                <p className="text-sm text-steel-600">
                  {d.contractor.legalName} · Proyecto {d.project.code} · Carpeta {d.folder.code} {d.folder.name}
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
                  <button
                    onClick={() => setViewing({ versionId: latest.id, fileName: latest.fileName })}
                    className="flex items-center gap-1.5 border border-steel-200 hover:border-steel-400 text-steel-600 text-sm font-semibold px-3 py-2 rounded transition-colors"
                  >
                    <Eye size={15} /> Ver
                  </button>
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
          {doc.contractor.legalName} · {doc.project.code}
        </p>

        <div>
          <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
            Comentarios / observaciones
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            placeholder="Opcional para aprobación, recomendado para observación o rechazo"
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
