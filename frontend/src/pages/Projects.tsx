import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Project {
  id: string;
  code: string;
  name: string;
  client: string;
  city: string;
  status: string;
  director: string;
  sstCoordinator: string;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const { user } = useAuth();
  const canCreate = user && ['admin', 'coordinador_sst'].includes(user.role);

  function load() {
    api.get('/projects').then((r) => setProjects(r.data));
  }

  useEffect(load, []);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black text-steel-900 tracking-tight">
            Proyectos
          </h1>
          <p className="text-steel-600 text-sm mt-1">
            Obras de construcción gestionadas por ETINAR
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-safety-500 hover:bg-safety-600 text-white text-sm font-semibold px-4 py-2.5 rounded transition-colors"
          >
            <Plus size={16} /> Nuevo proyecto
          </button>
        )}
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        {projects.map((p) => (
          <Link
            key={p.id}
            to={`/proyectos/${p.id}`}
            className="bg-white border border-steel-200 rounded-lg p-5 hover:border-safety-400 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-steel-400">{p.code}</span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  p.status === 'activo'
                    ? 'bg-verde-100 text-verde-600'
                    : 'bg-steel-200 text-steel-600'
                }`}
              >
                {p.status}
              </span>
            </div>
            <h3 className="font-semibold text-steel-900">{p.name}</h3>
            <p className="text-sm text-steel-600 mt-1">{p.client} · {p.city}</p>
            <p className="text-xs text-steel-400 mt-3">
              Coordinador SST: {p.sstCoordinator}
            </p>
          </Link>
        ))}
        {projects.length === 0 && (
          <p className="text-steel-400 col-span-2">No hay proyectos registrados.</p>
        )}
      </div>

      {showForm && <ProjectFormModal onClose={() => setShowForm(false)} onCreated={load} />}
    </div>
  );
}

function ProjectFormModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    code: '',
    name: '',
    client: '',
    city: '',
    startDate: '',
    director: '',
    sstCoordinator: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/projects', form);
      onCreated();
      onClose();
    } catch {
      setError('No se pudo crear el proyecto. Verifica que el código no esté repetido.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-steel-950/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-steel-200">
          <h2 className="font-semibold text-steel-900">Nuevo proyecto</h2>
          <button onClick={onClose} className="text-steel-400 hover:text-steel-900">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Field label="Código" value={form.code} onChange={(v) => setForm({ ...form, code: v })} placeholder="PRY-002" />
          <Field label="Nombre del proyecto" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Cliente" value={form.client} onChange={(v) => setForm({ ...form, client: v })} />
          <Field label="Ciudad" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
          <Field label="Fecha de inicio" type="date" value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} />
          <Field label="Director" value={form.director} onChange={(v) => setForm({ ...form, director: v })} />
          <Field label="Coordinador SST" value={form.sstCoordinator} onChange={(v) => setForm({ ...form, sstCoordinator: v })} />

          {error && <p className="text-rojo-600 bg-rojo-100 text-sm px-3 py-2 rounded">{error}</p>}

          <p className="text-xs text-steel-400">
            Al crear el proyecto se generará automáticamente la estructura de 9 carpetas documentales estándar.
          </p>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-safety-500 hover:bg-safety-600 text-white font-semibold py-2.5 rounded transition-colors disabled:opacity-60"
          >
            {saving ? 'Creando...' : 'Crear proyecto'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <input
        type={type}
        required
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-steel-200 rounded px-3 py-2 text-steel-900 focus:outline-none focus:ring-2 focus:ring-safety-500"
      />
    </div>
  );
}
