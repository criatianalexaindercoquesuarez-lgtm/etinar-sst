import { useEffect, useState } from 'react';
import { Plus, X, Folder as FolderIcon, FileText } from 'lucide-react';
import { api } from '../lib/api';

interface DocType {
  id: string;
  name: string;
  hasExpiration: boolean;
  validityDays?: number;
}
interface FolderItem {
  id: string;
  code: string;
  name: string;
  documentTypes: DocType[];
}
interface ProjectOption {
  id: string;
  code: string;
  name: string;
}
interface ProjectDetail extends ProjectOption {
  folders: FolderItem[];
}

export default function FolderAdmin() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [subcarpetaFor, setSubcarpetaFor] = useState<FolderItem | null>(null);

  useEffect(() => {
    api.get('/projects').then((r) => setProjects(r.data));
  }, []);

  function loadProject(id: string) {
    if (!id) {
      setProject(null);
      return;
    }
    setLoading(true);
    api
      .get(`/projects/${id}`)
      .then((r) => setProject(r.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadProject(selectedProjectId);
  }, [selectedProjectId]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-black text-steel-900 tracking-tight">
          Gestión de Carpetas
        </h1>
        <p className="text-steel-600 text-sm mt-1">
          Crea carpetas y subcarpetas nuevas sin depender de cambios de código.
          La estructura estándar (01-09) se mantiene como base; aquí puedes
          ampliarla.
        </p>
      </header>

      <div className="bg-white border border-steel-200 rounded-lg p-5">
        <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
          Selecciona un proyecto
        </label>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="w-full max-w-md border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
        >
          <option value="">— Selecciona —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
          ))}
        </select>
      </div>

      {loading && <p className="text-steel-400 text-sm">Cargando...</p>}

      {project && !loading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-steel-900">
              Carpetas de {project.code} — {project.name}
            </h2>
            <button
              onClick={() => setShowNewFolder(true)}
              className="flex items-center gap-2 bg-safety-500 hover:bg-safety-600 text-white text-sm font-semibold px-4 py-2 rounded transition-colors"
            >
              <Plus size={15} /> Nueva carpeta
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {project.folders
              .sort((a, b) => a.code.localeCompare(b.code))
              .map((f) => (
                <div key={f.id} className="bg-white border border-steel-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FolderIcon size={16} className="text-steel-500" />
                      <span className="font-mono text-xs text-steel-400">{f.code}</span>
                      <span className="font-semibold text-steel-900 text-sm">{f.name}</span>
                    </div>
                    <button
                      onClick={() => setSubcarpetaFor(f)}
                      className="flex items-center gap-1 text-xs font-semibold text-safety-500 hover:text-safety-600 shrink-0"
                    >
                      <Plus size={12} /> Subcarpeta
                    </button>
                  </div>
                  <div className="space-y-1">
                    {f.documentTypes.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-1.5 text-xs text-steel-600 px-2 py-1 bg-steel-50 rounded"
                      >
                        <FileText size={11} className="text-steel-400 shrink-0" />
                        <span className="truncate">{t.name}</span>
                        {t.hasExpiration && (
                          <span className="text-steel-400 shrink-0">
                            · vigencia {t.validityDays}d
                          </span>
                        )}
                      </div>
                    ))}
                    {f.documentTypes.length === 0 && (
                      <p className="text-xs text-steel-400 py-1">Sin subcarpetas todavía.</p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {showNewFolder && project && (
        <NewFolderModal
          projectId={project.id}
          existingCodes={project.folders.map((f) => f.code)}
          onClose={() => setShowNewFolder(false)}
          onCreated={() => loadProject(project.id)}
        />
      )}

      {subcarpetaFor && (
        <NewSubcarpetaModal
          folder={subcarpetaFor}
          onClose={() => setSubcarpetaFor(null)}
          onCreated={() => loadProject(selectedProjectId)}
        />
      )}
    </div>
  );
}

function NewFolderModal({
  projectId,
  existingCodes,
  onClose,
  onCreated,
}: {
  projectId: string;
  existingCodes: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!code.trim() || !name.trim()) {
      setError('Completa el código y el nombre.');
      return;
    }
    if (existingCodes.includes(code.trim())) {
      setError('Ya existe una carpeta con ese código en este proyecto.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post(`/projects/${projectId}/folders`, { code: code.trim(), name: name.trim() });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo crear la carpeta.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-steel-950/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-steel-900">Nueva carpeta</h2>
          <button onClick={onClose} className="text-steel-400 hover:text-steel-900">
            <X size={20} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
            Código (ej. 10)
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="10"
            className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
            Nombre de la carpeta
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="10_NUEVO_REQUISITO"
            className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
          />
        </div>

        {error && <p className="text-rojo-600 bg-rojo-100 text-sm px-3 py-2 rounded">{error}</p>}

        <button
          onClick={submit}
          disabled={saving}
          className="w-full bg-safety-500 hover:bg-safety-600 text-white font-semibold py-2.5 rounded transition-colors disabled:opacity-60"
        >
          {saving ? 'Creando...' : 'Crear carpeta'}
        </button>
      </div>
    </div>
  );
}

function NewSubcarpetaModal({
  folder,
  onClose,
  onCreated,
}: {
  folder: FolderItem;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [hasExpiration, setHasExpiration] = useState(false);
  const [validityDays, setValidityDays] = useState('365');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!name.trim()) {
      setError('Escribe un nombre.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/documents/types', {
        folderId: folder.id,
        name: name.trim(),
        hasExpiration,
        validityDays: hasExpiration ? Number(validityDays) : undefined,
      });
      onCreated();
      onClose();
    } catch {
      setError('No se pudo crear la subcarpeta.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-steel-950/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-steel-900">Nueva subcarpeta</h2>
          <button onClick={onClose} className="text-steel-400 hover:text-steel-900">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-steel-500">
          Dentro de {folder.code} — {folder.name}
        </p>

        <div>
          <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
            Nombre
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Certificado de vacunación"
            className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-steel-700">
          <input
            type="checkbox"
            checked={hasExpiration}
            onChange={(e) => setHasExpiration(e.target.checked)}
          />
          Este documento tiene fecha de vencimiento
        </label>

        {hasExpiration && (
          <input
            type="number"
            value={validityDays}
            onChange={(e) => setValidityDays(e.target.value)}
            placeholder="Vigencia en días"
            className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
          />
        )}

        {error && <p className="text-rojo-600 bg-rojo-100 text-sm px-3 py-2 rounded">{error}</p>}

        <button
          onClick={submit}
          disabled={saving}
          className="w-full bg-safety-500 hover:bg-safety-600 text-white font-semibold py-2.5 rounded transition-colors disabled:opacity-60"
        >
          {saving ? 'Creando...' : 'Crear subcarpeta'}
        </button>
      </div>
    </div>
  );
}
