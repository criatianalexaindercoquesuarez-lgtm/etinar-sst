import { useEffect, useState, type FormEvent } from 'react';
import { Plus, X, ShieldAlert, KeyRound, Copy, Check, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { ContractorStatusBadge } from '../components/Badges';

interface Contractor {
  id: string;
  legalName: string;
  ruc: string;
  legalRepresentative: string;
  email: string;
  status: string;
  blockReason?: string;
}

interface PortalUser {
  id: string;
  email: string;
  fullName: string;
  active: boolean;
  createdAt: string;
}

interface UploadLinkItem {
  id: string;
  token: string;
  active: boolean;
  expiresAt: string | null;
  useCount: number;
  createdAt: string;
}

export default function Contractors() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [accessFor, setAccessFor] = useState<Contractor | null>(null);

  function load() {
    api.get('/contractors').then((r) => setContractors(r.data));
  }
  useEffect(load, []);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black text-steel-900 tracking-tight">
            Contratistas
          </h1>
          <p className="text-steel-600 text-sm mt-1">Expedientes digitales de empresas contratistas</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-safety-500 hover:bg-safety-600 text-white text-sm font-semibold px-4 py-2.5 rounded transition-colors"
        >
          <Plus size={16} /> Nuevo contratista
        </button>
      </header>

      <div className="bg-white border border-steel-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-steel-50 text-steel-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-6 py-2.5 font-semibold">Razón social</th>
              <th className="text-left px-6 py-2.5 font-semibold">RUC</th>
              <th className="text-left px-6 py-2.5 font-semibold">Representante legal</th>
              <th className="text-left px-6 py-2.5 font-semibold">Correo</th>
              <th className="text-left px-6 py-2.5 font-semibold">Estado</th>
              <th className="text-left px-6 py-2.5 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {contractors.map((c) => (
              <tr key={c.id} className="border-t border-steel-100">
                <td className="px-6 py-3 font-medium text-steel-900">{c.legalName}</td>
                <td className="px-6 py-3 text-steel-600 font-mono text-xs">{c.ruc}</td>
                <td className="px-6 py-3 text-steel-600">{c.legalRepresentative}</td>
                <td className="px-6 py-3 text-steel-600">{c.email}</td>
                <td className="px-6 py-3">
                  <ContractorStatusBadge status={c.status} />
                  {c.blockReason && (c.status === 'bloqueado' || c.status === 'suspendido') && (
                    <div className="flex items-start gap-1 text-xs text-rojo-600 mt-1 max-w-xs">
                      <ShieldAlert size={12} className="shrink-0 mt-0.5" />
                      <span>{c.blockReason}</span>
                    </div>
                  )}
                </td>
                <td className="px-6 py-3 text-right">
                  <button
                    onClick={() => setAccessFor(c)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-steel-500 hover:text-safety-500 ml-auto"
                  >
                    <KeyRound size={13} /> Gestionar acceso
                  </button>
                </td>
              </tr>
            ))}
            {contractors.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-steel-400 text-center">
                  No hay contratistas registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {accessFor && (
        <PortalAccessModal contractor={accessFor} onClose={() => setAccessFor(null)} />
      )}

      {showForm && <ContractorFormModal onClose={() => setShowForm(false)} onCreated={load} />}
    </div>
  );
}

function PortalAccessModal({
  contractor,
  onClose,
}: {
  contractor: Contractor;
  onClose: () => void;
}) {
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState(contractor.legalRepresentative);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [links, setLinks] = useState<UploadLinkItem[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  function loadLinks() {
    setLoadingLinks(true);
    api
      .get(`/upload-links/contractor/${contractor.id}`)
      .then((r) => setLinks(r.data))
      .finally(() => setLoadingLinks(false));
  }
  useEffect(loadLinks, [contractor.id]);

  async function generateLink() {
    setGeneratingLink(true);
    try {
      await api.post(`/upload-links/contractor/${contractor.id}`, {});
      loadLinks();
    } finally {
      setGeneratingLink(false);
    }
  }

  async function revokeLink(id: string) {
    await api.post(`/upload-links/${id}/revoke`);
    loadLinks();
  }

  function copyLink(token: string, id: string) {
    const url = `${window.location.origin}/subir/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedLinkId(id);
    setTimeout(() => setCopiedLinkId(null), 2000);
  }

  function load() {
    setLoading(true);
    api
      .get(`/contractors/${contractor.id}/users`)
      .then((r) => setUsers(r.data))
      .finally(() => setLoading(false));
  }
  useEffect(load, [contractor.id]);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post(`/contractors/${contractor.id}/users`, {
        email: newEmail,
        fullName: newName,
      });
      setCredentials({ email: data.user.email, password: data.temporaryPassword });
      setShowNewForm(false);
      setNewEmail('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo crear el acceso. ¿El correo ya está en uso?');
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(userId: string, email: string) {
    setError('');
    try {
      const { data } = await api.post(`/contractors/users/${userId}/reset-password`);
      setCredentials({ email, password: data.temporaryPassword });
    } catch {
      setError('No se pudo reiniciar la contraseña.');
    }
  }

  async function toggleActive(userId: string, active: boolean) {
    await api.put(`/contractors/users/${userId}/active`, { active });
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
    <div className="fixed inset-0 bg-steel-950/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-steel-200">
          <div>
            <h2 className="font-semibold text-steel-900">Acceso al portal</h2>
            <p className="text-xs text-steel-500">{contractor.legalName}</p>
          </div>
          <button onClick={onClose} className="text-steel-400 hover:text-steel-900">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
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

          {error && <p className="text-rojo-600 bg-rojo-100 text-sm px-3 py-2 rounded">{error}</p>}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-steel-900">Usuarios con acceso</h3>
              <button
                onClick={() => setShowNewForm(true)}
                className="flex items-center gap-1 text-xs font-semibold text-safety-500 hover:text-safety-600"
              >
                <Plus size={13} /> Crear acceso
              </button>
            </div>

            {loading && <p className="text-sm text-steel-400">Cargando...</p>}

            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between border border-steel-100 rounded px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-steel-900 truncate">{u.fullName}</div>
                    <div className="text-xs text-steel-500 truncate">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        u.active ? 'bg-verde-100 text-verde-600' : 'bg-steel-200 text-steel-600'
                      }`}
                    >
                      {u.active ? 'Activo' : 'Deshabilitado'}
                    </span>
                    <button
                      onClick={() => resetPassword(u.id, u.email)}
                      title="Generar nueva contraseña"
                      className="text-steel-400 hover:text-safety-500"
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button
                      onClick={() => toggleActive(u.id, !u.active)}
                      className="text-xs font-semibold text-steel-500 hover:text-steel-900"
                    >
                      {u.active ? 'Deshabilitar' : 'Habilitar'}
                    </button>
                  </div>
                </div>
              ))}
              {!loading && users.length === 0 && (
                <p className="text-sm text-steel-400 py-3">
                  Este contratista aún no tiene ningún usuario de portal creado.
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-steel-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-semibold text-steel-900">Enlace de recepción documental</h3>
                <p className="text-xs text-steel-500">
                  Alternativa sin usuario/contraseña: quien lo abra puede subir documentos de esta empresa
                </p>
              </div>
              <button
                onClick={generateLink}
                disabled={generatingLink}
                className="flex items-center gap-1 text-xs font-semibold text-safety-500 hover:text-safety-600 shrink-0 disabled:opacity-60"
              >
                <Plus size={13} /> {generatingLink ? 'Generando...' : 'Generar enlace'}
              </button>
            </div>

            {loadingLinks && <p className="text-sm text-steel-400">Cargando...</p>}

            <div className="space-y-2">
              {links.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between border border-steel-100 rounded px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-steel-600 truncate">
                      /subir/{l.token.substring(0, 16)}...
                    </div>
                    <div className="text-xs text-steel-400">
                      {l.useCount} uso(s) · creado {new Date(l.createdAt).toLocaleDateString('es-EC')}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        l.active ? 'bg-verde-100 text-verde-600' : 'bg-steel-200 text-steel-600'
                      }`}
                    >
                      {l.active ? 'Activo' : 'Revocado'}
                    </span>
                    {l.active && (
                      <>
                        <button
                          onClick={() => copyLink(l.token, l.id)}
                          title="Copiar enlace"
                          className="text-steel-400 hover:text-safety-500"
                        >
                          {copiedLinkId === l.id ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <button
                          onClick={() => revokeLink(l.id)}
                          className="text-xs font-semibold text-steel-500 hover:text-rojo-600"
                        >
                          Revocar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {!loadingLinks && links.length === 0 && (
                <p className="text-sm text-steel-400 py-3">
                  No hay ningún enlace de recepción generado para este contratista.
                </p>
              )}
            </div>
          </div>

          {showNewForm && (
            <form onSubmit={createUser} className="border-t border-steel-200 pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-steel-900">Nuevo acceso</h3>
              <div>
                <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
                  Nombre de contacto
                </label>
                <input
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
                  Correo (será el usuario de acceso)
                </label>
                <input
                  required
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
                />
              </div>
              <p className="text-xs text-steel-400">
                La contraseña se genera automáticamente y solo se muestra una vez.
              </p>
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-safety-500 hover:bg-safety-600 text-white font-semibold py-2.5 rounded transition-colors disabled:opacity-60"
              >
                {saving ? 'Creando...' : 'Crear acceso'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function ContractorFormModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    legalName: '',
    legalRepresentative: '',
    ruc: '',
    email: '',
    phone: '',
    address: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/contractors', form);
      onCreated();
      onClose();
    } catch {
      setError('No se pudo crear el contratista. Verifica que el RUC no esté repetido.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-steel-950/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-steel-200">
          <h2 className="font-semibold text-steel-900">Nuevo contratista</h2>
          <button onClick={onClose} className="text-steel-400 hover:text-steel-900">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {[
            ['legalName', 'Razón social'],
            ['legalRepresentative', 'Representante legal'],
            ['ruc', 'RUC'],
            ['email', 'Correo electrónico'],
            ['phone', 'Teléfono'],
            ['address', 'Dirección'],
          ].map(([key, label]) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
                {label}
              </label>
              <input
                required={key !== 'phone' && key !== 'address'}
                value={(form as any)[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
              />
            </div>
          ))}

          {error && <p className="text-rojo-600 bg-rojo-100 text-sm px-3 py-2 rounded">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-safety-500 hover:bg-safety-600 text-white font-semibold py-2.5 rounded transition-colors disabled:opacity-60"
          >
            {saving ? 'Creando...' : 'Crear contratista'}
          </button>
        </form>
      </div>
    </div>
  );
}
