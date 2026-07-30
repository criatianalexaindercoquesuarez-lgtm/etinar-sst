import { useEffect, useState, type FormEvent } from 'react';
import { Plus, X, ShieldAlert } from 'lucide-react';
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

export default function Contractors() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [showForm, setShowForm] = useState(false);

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
              </tr>
            ))}
            {contractors.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-6 text-steel-400 text-center">
                  No hay contratistas registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && <ContractorFormModal onClose={() => setShowForm(false)} onCreated={load} />}
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
