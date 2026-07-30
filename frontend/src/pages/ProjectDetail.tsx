import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Folder as FolderIcon, Upload, Plus, ChevronLeft, Eye } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { StatusBadge } from '../components/Badges';
import FileDropZone from '../components/FileDropZone';
import DocumentViewerModal from '../components/DocumentViewerModal';

interface DocType {
  id: string;
  name: string;
  hasExpiration: boolean;
  validityDays?: number;
}
interface Folder {
  id: string;
  code: string;
  name: string;
  documentTypes: DocType[];
}
interface ProjectDetail {
  id: string;
  code: string;
  name: string;
  client: string;
  city: string;
  director: string;
  sstCoordinator: string;
  folders: Folder[];
}
interface DocRow {
  id: string;
  status: string;
  documentType: { name: string };
  folder: { code: string; name: string };
  contractor: { legalName: string };
  versions: { id: string; versionNumber: number; fileName: string }[];
}

export default function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [uploadType, setUploadType] = useState<DocType | null>(null);
  const [viewing, setViewing] = useState<{ versionId: string; fileName: string } | null>(null);

  const canManage = user && ['admin', 'coordinador_sst'].includes(user.role);
  const isContractor = user?.role === 'contratista';

  function load() {
    api.get(`/projects/${id}`).then((r) => setProject(r.data));
    api.get(`/documents/project/${id}`).then((r) => setDocs(r.data));
  }

  useEffect(load, [id]);

  if (!project) return <p className="text-steel-400">Cargando proyecto...</p>;

  return (
    <div className="space-y-6">
      <Link to="/proyectos" className="flex items-center gap-1 text-sm text-steel-600 hover:text-steel-900 w-fit">
        <ChevronLeft size={16} /> Proyectos
      </Link>

      <header>
        <span className="text-xs font-mono text-steel-400">{project.code}</span>
        <h1 className="font-display text-3xl font-black text-steel-900 tracking-tight">
          {project.name}
        </h1>
        <p className="text-steel-600 text-sm mt-1">
          {project.client} · {project.city} · Coordinador SST: {project.sstCoordinator}
        </p>
      </header>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <h2 className="font-semibold text-steel-900 mb-3 text-sm uppercase tracking-wide">
            Estructura documental
          </h2>
          <div className="space-y-1.5">
            {project.folders.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFolder(f)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-sm text-left transition-colors ${
                  selectedFolder?.id === f.id
                    ? 'bg-steel-900 text-white'
                    : 'bg-white border border-steel-200 text-steel-700 hover:border-safety-400'
                }`}
              >
                <FolderIcon size={16} />
                <span className="font-mono text-xs opacity-60">{f.code}</span>
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-xs opacity-60">{f.documentTypes.length}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          {selectedFolder ? (
            <div className="bg-white border border-steel-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-steel-900">
                  {selectedFolder.code} — {selectedFolder.name}
                </h3>
                {canManage && (
                  <button
                    onClick={() => setShowTypeForm(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-safety-500 hover:text-safety-600"
                  >
                    <Plus size={14} /> Tipo documental
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {selectedFolder.documentTypes.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between px-4 py-3 border border-steel-100 rounded"
                  >
                    <div>
                      <div className="text-sm font-medium text-steel-900">{t.name}</div>
                      {t.hasExpiration && (
                        <div className="text-xs text-steel-400">
                          Vigencia: {t.validityDays} días
                        </div>
                      )}
                    </div>
                    {isContractor && (
                      <button
                        onClick={() => setUploadType(t)}
                        className="flex items-center gap-1.5 text-xs font-semibold bg-steel-900 hover:bg-steel-800 text-white px-3 py-1.5 rounded transition-colors"
                      >
                        <Upload size={13} /> Cargar
                      </button>
                    )}
                  </div>
                ))}
                {selectedFolder.documentTypes.length === 0 && (
                  <p className="text-steel-400 text-sm py-4">
                    Aún no hay tipos documentales configurados en esta carpeta.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-dashed border-steel-200 rounded-lg p-10 text-center text-steel-400 text-sm">
              Selecciona una carpeta para ver sus tipos documentales.
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-steel-200 rounded-lg overflow-hidden">
        <h2 className="font-semibold text-steel-900 px-6 pt-6 pb-4">
          Documentos cargados en el proyecto
        </h2>
        <table className="w-full text-sm">
          <thead className="bg-steel-50 text-steel-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-6 py-2.5 font-semibold">Documento</th>
              <th className="text-left px-6 py-2.5 font-semibold">Contratista</th>
              <th className="text-left px-6 py-2.5 font-semibold">Carpeta</th>
              <th className="text-left px-6 py-2.5 font-semibold">Versión</th>
              <th className="text-left px-6 py-2.5 font-semibold">Estado</th>
              <th className="text-left px-6 py-2.5 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => {
              const latest = d.versions[d.versions.length - 1];
              return (
                <tr key={d.id} className="border-t border-steel-100">
                  <td className="px-6 py-3 font-medium text-steel-900">{d.documentType.name}</td>
                  <td className="px-6 py-3 text-steel-600">{d.contractor.legalName}</td>
                  <td className="px-6 py-3 text-steel-600">{d.folder.code} {d.folder.name}</td>
                  <td className="px-6 py-3 text-steel-600">v{d.versions.length}</td>
                  <td className="px-6 py-3"><StatusBadge status={d.status} /></td>
                  <td className="px-6 py-3 text-right">
                    {latest && (
                      <button
                        onClick={() => setViewing({ versionId: latest.id, fileName: latest.fileName })}
                        className="flex items-center gap-1 text-xs font-semibold text-steel-500 hover:text-safety-500 ml-auto"
                      >
                        <Eye size={13} /> Ver
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {docs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-steel-400 text-center">
                  Aún no se han cargado documentos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {viewing && (
        <DocumentViewerModal
          versionId={viewing.versionId}
          fileName={viewing.fileName}
          onClose={() => setViewing(null)}
        />
      )}

      {showTypeForm && selectedFolder && (
        <DocTypeFormModal
          folderId={selectedFolder.id}
          onClose={() => setShowTypeForm(false)}
          onCreated={load}
        />
      )}
      {uploadType && project && (
        <UploadModal
          projectId={project.id}
          folderId={selectedFolder!.id}
          documentType={uploadType}
          contractorId={user!.contractorId!}
          onClose={() => setUploadType(null)}
          onUploaded={load}
        />
      )}
    </div>
  );
}

function DocTypeFormModal({
  folderId,
  onClose,
  onCreated,
}: {
  folderId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [hasExpiration, setHasExpiration] = useState(false);
  const [validityDays, setValidityDays] = useState('365');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    await api.post('/documents/types', {
      folderId,
      name,
      hasExpiration,
      validityDays: hasExpiration ? Number(validityDays) : undefined,
    });
    setSaving(false);
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-steel-950/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6 space-y-4">
        <h2 className="font-semibold text-steel-900">Nuevo tipo documental</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Póliza de responsabilidad civil"
          className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
        />
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
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 border border-steel-200 rounded py-2 text-sm font-semibold text-steel-700">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 bg-safety-500 hover:bg-safety-600 text-white rounded py-2 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadModal({
  projectId,
  folderId,
  documentType,
  contractorId,
  onClose,
  onUploaded,
}: {
  projectId: string;
  folderId: string;
  documentType: DocType;
  contractorId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!file) {
      setError('Selecciona un archivo.');
      return;
    }
    setSaving(true);
    setError('');
    const form = new FormData();
    form.append('projectId', projectId);
    form.append('contractorId', contractorId);
    form.append('folderId', folderId);
    form.append('documentTypeId', documentType.id);
    if (dueDate) form.append('dueDate', dueDate);
    form.append('file', file);
    try {
      await api.post('/documents/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUploaded();
      onClose();
    } catch {
      setError('No se pudo cargar el documento.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-steel-950/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6 space-y-4">
        <h2 className="font-semibold text-steel-900">Cargar documento</h2>
        <p className="text-sm text-steel-600">{documentType.name}</p>

        <FileDropZone file={file} onChange={setFile} />

        {documentType.hasExpiration && (
          <div>
            <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
              Fecha de vencimiento
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
            />
          </div>
        )}

        {error && <p className="text-rojo-600 bg-rojo-100 text-sm px-3 py-2 rounded">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 border border-steel-200 rounded py-2 text-sm font-semibold text-steel-700">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 bg-safety-500 hover:bg-safety-600 text-white rounded py-2 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? 'Cargando...' : 'Cargar documento'}
          </button>
        </div>
      </div>
    </div>
  );
}
