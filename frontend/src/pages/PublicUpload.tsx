import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, AlertTriangle, Building2 } from 'lucide-react';
import FileDropZone from '../components/FileDropZone';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface DocType {
  id: string;
  name: string;
  hasExpiration: boolean;
}
interface FolderCtx {
  id: string;
  code: string;
  name: string;
  documentTypes: DocType[];
}
interface ProjectCtx {
  id: string;
  code: string;
  name: string;
  folders: FolderCtx[];
}
interface Context {
  contractorName: string;
  projects: ProjectCtx[];
}

export default function PublicUpload() {
  const { token } = useParams();
  const [context, setContext] = useState<Context | null>(null);
  const [loadError, setLoadError] = useState('');

  const [projectId, setProjectId] = useState('');
  const [folderId, setFolderId] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [uploaderName, setUploaderName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_BASE}/public/upload-link/${token}`)
      .then((r) => setContext(r.data))
      .catch((err) => {
        if (err?.response?.status === 410) {
          setLoadError('Este enlace ya no está disponible (fue desactivado o expiró). Solicita uno nuevo a ETINAR.');
        } else {
          setLoadError('Este enlace no es válido.');
        }
      });
  }, [token]);

  const selectedProject = context?.projects.find((p) => p.id === projectId);
  const selectedFolder = selectedProject?.folders.find((f) => f.id === folderId);
  const selectedType = selectedFolder?.documentTypes.find((t) => t.id === documentTypeId);

  async function handleSubmit() {
    if (!file || !projectId || !folderId || !documentTypeId || !uploaderName.trim()) {
      setSubmitError('Completa todos los campos y selecciona un archivo.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    const form = new FormData();
    form.append('projectId', projectId);
    form.append('folderId', folderId);
    form.append('documentTypeId', documentTypeId);
    form.append('uploaderName', uploaderName);
    if (dueDate) form.append('dueDate', dueDate);
    form.append('file', file);
    try {
      await axios.post(`${API_BASE}/public/upload-link/${token}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccess(true);
    } catch {
      setSubmitError('No se pudo enviar el documento. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-steel-50 flex items-center justify-center px-4">
        <div className="bg-white border border-steel-200 rounded-lg p-8 max-w-md text-center space-y-3">
          <AlertTriangle className="mx-auto text-rojo-600" size={32} />
          <p className="text-steel-700">{loadError}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-steel-50 flex items-center justify-center px-4">
        <div className="bg-white border border-steel-200 rounded-lg p-8 max-w-md text-center space-y-3">
          <CheckCircle2 className="mx-auto text-verde-600" size={36} />
          <h1 className="font-display text-xl font-black text-steel-900">Documento enviado</h1>
          <p className="text-steel-600 text-sm">
            Tu documento fue recibido y quedará pendiente de revisión por el equipo SST de ETINAR.
          </p>
          <button
            onClick={() => {
              setSuccess(false);
              setFile(null);
              setDocumentTypeId('');
            }}
            className="text-sm font-semibold text-safety-500 hover:text-safety-600"
          >
            Subir otro documento
          </button>
        </div>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="min-h-screen bg-steel-50 flex items-center justify-center">
        <p className="text-steel-400 text-sm">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-steel-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-safety-500 flex items-center justify-center font-display font-black text-white text-sm">
              E
            </div>
            <span className="font-display text-xl font-black text-steel-900 tracking-tight">
              SST ETINAR
            </span>
          </div>
          <p className="text-steel-500 text-sm">Recepción documental</p>
        </div>

        <div className="bg-white border border-steel-200 rounded-lg p-6 space-y-5">
          <div className="flex items-center gap-2 bg-steel-50 rounded px-3 py-2.5">
            <Building2 size={16} className="text-steel-500 shrink-0" />
            <span className="text-sm font-medium text-steel-900">{context.contractorName}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
              Tu nombre
            </label>
            <input
              value={uploaderName}
              onChange={(e) => setUploaderName(e.target.value)}
              placeholder="Nombre de quien sube el documento"
              className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
              Proyecto
            </label>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setFolderId('');
                setDocumentTypeId('');
              }}
              className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
            >
              <option value="">Selecciona un proyecto</option>
              {context.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>

          {selectedProject && (
            <div>
              <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
                Carpeta documental
              </label>
              <select
                value={folderId}
                onChange={(e) => {
                  setFolderId(e.target.value);
                  setDocumentTypeId('');
                }}
                className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
              >
                <option value="">Selecciona una carpeta</option>
                {selectedProject.folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.code} — {f.name}</option>
                ))}
              </select>
            </div>
          )}

          {selectedFolder && (
            <div>
              <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
                Tipo de documento
              </label>
              <select
                value={documentTypeId}
                onChange={(e) => setDocumentTypeId(e.target.value)}
                className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
              >
                <option value="">Selecciona un tipo</option>
                {selectedFolder.documentTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {selectedFolder.documentTypes.length === 0 && (
                <p className="text-xs text-steel-400 mt-1">
                  Esta carpeta no tiene tipos documentales configurados todavía.
                </p>
              )}
            </div>
          )}

          {selectedType?.hasExpiration && (
            <div>
              <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
                Fecha de vencimiento del documento
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
              />
            </div>
          )}

          {documentTypeId && (
            <div>
              <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
                Archivo
              </label>
              <FileDropZone file={file} onChange={setFile} />
            </div>
          )}

          {submitError && (
            <p className="text-rojo-600 bg-rojo-100 text-sm px-3 py-2 rounded">{submitError}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-safety-500 hover:bg-safety-600 text-white font-semibold py-2.5 rounded transition-colors disabled:opacity-60"
          >
            {submitting ? 'Enviando...' : 'Enviar documento'}
          </button>
        </div>

        <p className="text-center text-xs text-steel-400 mt-4">
          Este enlace es personal para {context.contractorName}. No lo compartas fuera de tu empresa.
        </p>
      </div>
    </div>
  );
}
