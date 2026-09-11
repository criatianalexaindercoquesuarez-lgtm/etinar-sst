import { useEffect, useState, type FormEvent } from 'react';
import { Plus, X, Copy, Check, RefreshCw, Pencil, Building2 } from 'lucide-react';
import { api } from '../lib/api';
import { ROLE_LABELS } from '../lib/auth';

interface TeamMember {
  id: string;
  email: string;
  fullName: string;
  role: string;
  jobTitle?: string;
  active: boolean;
  createdAt: string;
}

interface ProjectOption {
  id: string;
  code: string;
  name: string;
}

interface AssignmentItem {
  id: string;
  project: ProjectOption;
}

const ASSIGNABLE_ROLES = ['coordinador_sst', 'director', 'admin'];

export default function Team() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingJobTitleFor, setEditingJobTitleFor] = useState<string | null>(null);
  const [jobTitleDraft, setJobTitleDraft] = useState('');
  const [assignFor, setAssignFor] = useState<TeamMember | null>(null);

  function load() {
    setLoading(true);
    api.get('/team-users').then((r) => setMembers(r.data)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function resetPassword(id: string, email: string) {
    const { data } = await api.post(`/team-users/${id}/reset-password`);
    setCredentials({ email, password: data.temporaryPassword });
  }

  async function toggleActive(id: string, active: boolean) {
    await api.put(`/team-users/${id}/active`, { active });
    load();
  }

  async function changeRole(id: string, role: string) {
    await api.put(`/team-users/${id}/role`, { role });
    load();
  }

  async function saveJobTitle(id: string) {
    await api.put(`/team-users/${id}/job-title`, { jobTitle: jobTitleDraft });
    setEditingJobTitleFor(null);
    load();
  }

  function copyCredentials() {
    if (!credentials) return;
    navigator.clipboard.writeText(
      `Usuario: ${credentials.email}\nContraseña temporal: ${credentials.password}\nURL: ${window.location.origin}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black text-steel-900 tracking-tight">
            Equipo ETINAR
          </h1>
          <p className="text-steel-600 text-sm mt-1">
            Usuarios internos que administran el sistema (no contratistas)
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-safety-500 hover:bg-safety-600 text-white text-sm font-semibold px-4 py-2.5 rounded transition-colors"
        >
          <Plus size={16} /> Añadir persona
        </button>
      </header>

      {credentials && (
        <div className="bg-verde-100 border border-verde-600/30 rounded-lg p-4 space-y-2">
          <p className="text-xs font-semibold text-verde-600 uppercase tracking-wide">
            Copia y comparte esto ahora — no se volverá a mostrar
          </p>
          <div className="bg-white rounded px-3 py-2 font-mono text-sm text-steel-900 space-y-0.5">
            <div>Usuario: {credentials.email}</div>
            <div>Contraseña: {credentials.password}</div>
          </div>
          <button
            onClick={copyCredentials}
            className="flex items-center gap-1.5 text-xs font-semibold text-verde-600 hover:text-verde-700"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copiado' : 'Copiar usuario, contraseña y enlace'}
          </button>
        </div>
      )}

      <div className="bg-white border border-steel-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-steel-50 text-steel-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-6 py-2.5 font-semibold">Nombre</th>
              <th className="text-left px-6 py-2.5 font-semibold">Cargo</th>
              <th className="text-left px-6 py-2.5 font-semibold">Correo</th>
              <th className="text-left px-6 py-2.5 font-semibold">Rol del sistema</th>
              <th className="text-left px-6 py-2.5 font-semibold">Estado</th>
              <th className="text-left px-6 py-2.5 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-steel-100">
                <td className="px-6 py-3 font-medium text-steel-900">{m.fullName}</td>
                <td className="px-6 py-3 text-steel-600">
                  {editingJobTitleFor === m.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        value={jobTitleDraft}
                        onChange={(e) => setJobTitleDraft(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveJobTitle(m.id)}
                        placeholder="Ej: Asistente de Talento Humano"
                        className="border border-steel-200 rounded px-2 py-1 text-xs w-48"
                      />
                      <button onClick={() => saveJobTitle(m.id)} className="text-verde-600 hover:text-verde-700">
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingJobTitleFor(m.id);
                        setJobTitleDraft(m.jobTitle || '');
                      }}
                      className="flex items-center gap-1.5 text-left hover:text-safety-500 group"
                    >
                      {m.jobTitle || <span className="text-steel-400 italic">Sin cargo — clic para agregar</span>}
                      <Pencil size={11} className="opacity-0 group-hover:opacity-60" />
                    </button>
                  )}
                </td>
                <td className="px-6 py-3 text-steel-600">{m.email}</td>
                <td className="px-6 py-3">
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m.id, e.target.value)}
                    className="text-xs border border-steel-200 rounded px-2 py-1"
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-3">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      m.active ? 'bg-verde-100 text-verde-600' : 'bg-steel-200 text-steel-600'
                    }`}
                  >
                    {m.active ? 'Activo' : 'Deshabilitado'}
                  </span>
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => setAssignFor(m)}
                      title="Restringir a proyecto(s) específicos"
                      className="flex items-center gap-1 text-xs font-semibold text-steel-500 hover:text-safety-500"
                    >
                      <Building2 size={13} /> Proyectos
                    </button>
                    <button
                      onClick={() => resetPassword(m.id, m.email)}
                      title="Generar nueva contraseña"
                      className="text-steel-400 hover:text-safety-500"
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button
                      onClick={() => toggleActive(m.id, !m.active)}
                      className="text-xs font-semibold text-steel-500 hover:text-steel-900"
                    >
                      {m.active ? 'Deshabilitar' : 'Habilitar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && members.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-steel-400 text-center">
                  No hay usuarios internos registrados todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <NewMemberModal
          onClose={() => setShowForm(false)}
          onCreated={(creds) => {
            setCredentials(creds);
            load();
          }}
        />
      )}
      {assignFor && (
        <AssignProjectsModal member={assignFor} onClose={() => setAssignFor(null)} />
      )}
    </div>
  );
}

function AssignProjectsModal({
  member,
  onClose,
}: {
  member: TeamMember;
  onClose: () => void;
}) {
  const [allProjects, setAllProjects] = useState<ProjectOption[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    Promise.all([api.get('/projects'), api.get(`/team-users/${member.id}/projects`)])
      .then(([projectsRes, assignmentsRes]) => {
        setAllProjects(projectsRes.data);
        setAssignments(assignmentsRes.data);
      })
      .catch(() => setError('No se pudo cargar la información.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, [member.id]);

  const assignedIds = assignments.map((a) => a.project.id);
  const availableProjects = allProjects.filter((p) => !assignedIds.includes(p.id));
  const isRestricted = assignments.length > 0;

  async function handleAssign() {
    if (!selectedProjectId) return;
    setSaving(true);
    setError('');
    try {
      await api.post(`/team-users/${member.id}/projects/${selectedProjectId}`);
      setSelectedProjectId('');
      load();
    } catch {
      setError('No se pudo asignar el proyecto.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUnassign(linkId: string) {
    setSaving(true);
    try {
      await api.delete(`/team-users/projects/${linkId}`);
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-steel-950/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-steel-200">
          <div>
            <h2 className="font-semibold text-steel-900">Restringir a proyecto(s)</h2>
            <p className="text-xs text-steel-500">{member.fullName}</p>
          </div>
          <button onClick={onClose} className="text-steel-400 hover:text-steel-900">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div
            className={`text-xs px-3 py-2 rounded ${
              isRestricted ? 'bg-amarillo-100 text-amarillo-600' : 'bg-verde-100 text-verde-600'
            }`}
          >
            {isRestricted
              ? 'Esta persona SOLO ve y revisa los proyectos listados abajo.'
              : 'Esta persona ve TODOS los proyectos (sin restricción). Asigna uno para restringirla.'}
          </div>

          {error && <p className="text-rojo-600 bg-rojo-100 text-sm px-3 py-2 rounded">{error}</p>}

          <div>
            <h3 className="text-sm font-semibold text-steel-900 mb-2">Proyectos asignados</h3>
            {loading && <p className="text-sm text-steel-400">Cargando...</p>}
            <div className="space-y-1.5">
              {assignments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between border border-steel-100 rounded px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-verde-600 shrink-0" />
                    <span className="text-steel-900 font-medium">{a.project.code}</span>
                    <span className="text-steel-600">{a.project.name}</span>
                  </div>
                  <button
                    onClick={() => handleUnassign(a.id)}
                    disabled={saving}
                    className="text-xs font-semibold text-steel-400 hover:text-rojo-600"
                  >
                    Quitar
                  </button>
                </div>
              ))}
              {!loading && assignments.length === 0 && (
                <p className="text-sm text-steel-400 py-2">Ninguno — acceso global.</p>
              )}
            </div>
          </div>

          {!loading && (
            <div className="border-t border-steel-200 pt-4">
              <h3 className="text-sm font-semibold text-steel-900 mb-2">Asignar un proyecto</h3>
              {availableProjects.length === 0 ? (
                <p className="text-sm text-steel-400">No hay más proyectos disponibles para asignar.</p>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="flex-1 border border-steel-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-safety-500"
                  >
                    <option value="">Selecciona un proyecto</option>
                    {availableProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAssign}
                    disabled={!selectedProjectId || saving}
                    className="bg-safety-500 hover:bg-safety-600 text-white text-sm font-semibold px-4 py-2 rounded transition-colors disabled:opacity-60 shrink-0"
                  >
                    Asignar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewMemberModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (creds: { email: string; password: string }) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [role, setRole] = useState('coordinador_sst');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post('/team-users', { fullName, email, role, jobTitle });
      onCreated({ email: data.user.email, password: data.temporaryPassword });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo crear el usuario.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-steel-950/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-steel-900">Añadir persona al equipo</h2>
          <button onClick={onClose} className="text-steel-400 hover:text-steel-900">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
              Nombre completo
            </label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
              Cargo / puesto (libre, escribe lo que sea)
            </label>
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Ej: Asistente de Talento Humano, Técnico de Seguridad..."
              className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
              Correo (será su usuario)
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
              Rol del sistema (define qué puede hacer)
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
            >
              <option value="coordinador_sst">Coordinador SST — revisa y aprueba documentación</option>
              <option value="director">Director — solo consulta indicadores</option>
              <option value="admin">Administrador — control total del sistema</option>
            </select>
          </div>

          {error && <p className="text-rojo-600 bg-rojo-100 text-sm px-3 py-2 rounded">{error}</p>}

          <p className="text-xs text-steel-400">
            La contraseña se genera automáticamente y solo se muestra una vez. Después de crearlo,
            usa el botón "Proyectos" en la tabla para restringirlo a uno o varios proyectos si no
            debe ver todo.
          </p>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-safety-500 hover:bg-safety-600 text-white font-semibold py-2.5 rounded transition-colors disabled:opacity-60"
          >
            {saving ? 'Creando...' : 'Crear usuario'}
          </button>
        </form>
      </div>
    </div>
  );
}
