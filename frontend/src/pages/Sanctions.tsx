import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { api } from '../lib/api';

interface Rule {
  id: string;
  trigger: string;
  action: string;
  fineAmount?: number;
  gracePeriodDays?: number;
  description: string;
  active: boolean;
}

interface AppliedSanction {
  id: string;
  reason: string;
  resolved: boolean;
  appliedAt: string;
  contractor: { legalName: string };
  rule: { action: string };
}

const TRIGGER_LABELS: Record<string, string> = {
  documento_vencido: 'Documento vencido',
  documento_no_cargado: 'Documento no cargado',
  observacion_no_corregida: 'Observación no corregida',
  examen_medico_vencido: 'Examen médico vencido',
  capacitacion_vencida: 'Capacitación vencida',
};

const ACTION_LABELS: Record<string, string> = {
  multa: 'Multa',
  bloqueo_trabajador: 'Bloqueo de trabajador',
  bloqueo_empresa: 'Bloqueo de empresa',
  suspension: 'Suspensión',
  denegar_ingreso: 'Denegar ingreso a obra',
};

export default function Sanctions() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [applied, setApplied] = useState<AppliedSanction[]>([]);
  const [showForm, setShowForm] = useState(false);

  function load() {
    api.get('/sanctions/rules').then((r) => setRules(r.data));
    api.get('/sanctions').then((r) => setApplied(r.data));
  }
  useEffect(load, []);

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black text-steel-900 tracking-tight">
            Reglas de Sanción y Multas
          </h1>
          <p className="text-steel-600 text-sm mt-1">
            El motor de cumplimiento aplica estas reglas automáticamente, sin intervención manual
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-safety-500 hover:bg-safety-600 text-white text-sm font-semibold px-4 py-2.5 rounded transition-colors"
        >
          <Plus size={16} /> Nueva regla
        </button>
      </header>

      <div className="bg-white border border-steel-200 rounded-lg overflow-hidden">
        <h2 className="font-semibold text-steel-900 px-6 pt-6 pb-4">Reglas configuradas</h2>
        <table className="w-full text-sm">
          <thead className="bg-steel-50 text-steel-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-6 py-2.5 font-semibold">Cuando ocurra</th>
              <th className="text-left px-6 py-2.5 font-semibold">Aplicar</th>
              <th className="text-left px-6 py-2.5 font-semibold">Días de gracia</th>
              <th className="text-left px-6 py-2.5 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-t border-steel-100">
                <td className="px-6 py-3 font-medium text-steel-900">
                  {TRIGGER_LABELS[r.trigger] ?? r.trigger}
                </td>
                <td className="px-6 py-3 text-steel-600">
                  {ACTION_LABELS[r.action] ?? r.action}
                  {r.action === 'multa' && r.fineAmount ? ` ($${r.fineAmount})` : ''}
                </td>
                <td className="px-6 py-3 text-steel-600">{r.gracePeriodDays ?? 0} día(s)</td>
                <td className="px-6 py-3">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      r.active ? 'bg-verde-100 text-verde-600' : 'bg-steel-200 text-steel-600'
                    }`}
                  >
                    {r.active ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-6 text-steel-400 text-center">
                  No hay reglas configuradas. Sin reglas, el sistema solo genera alertas informativas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-steel-200 rounded-lg overflow-hidden">
        <h2 className="font-semibold text-steel-900 px-6 pt-6 pb-4">
          Sanciones aplicadas automáticamente
        </h2>
        <table className="w-full text-sm">
          <thead className="bg-steel-50 text-steel-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-6 py-2.5 font-semibold">Fecha</th>
              <th className="text-left px-6 py-2.5 font-semibold">Contratista</th>
              <th className="text-left px-6 py-2.5 font-semibold">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {applied.map((s) => (
              <tr key={s.id} className="border-t border-steel-100">
                <td className="px-6 py-3 text-steel-500 text-xs font-mono whitespace-nowrap">
                  {new Date(s.appliedAt).toLocaleString('es-EC')}
                </td>
                <td className="px-6 py-3 font-medium text-steel-900">{s.contractor.legalName}</td>
                <td className="px-6 py-3 text-steel-600">{s.reason}</td>
              </tr>
            ))}
            {applied.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-6 text-steel-400 text-center">
                  Aún no se han aplicado sanciones.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <RuleFormModal onClose={() => setShowForm(false)} onCreated={load} />
      )}
    </div>
  );
}

function RuleFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [trigger, setTrigger] = useState('documento_vencido');
  const [action, setAction] = useState('bloqueo_empresa');
  const [fineAmount, setFineAmount] = useState('');
  const [gracePeriodDays, setGracePeriodDays] = useState('0');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    await api.post('/sanctions/rules', {
      trigger,
      action,
      fineAmount: action === 'multa' ? Number(fineAmount) : undefined,
      gracePeriodDays: Number(gracePeriodDays) || 0,
      description,
    });
    setSaving(false);
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-steel-950/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-steel-900">Nueva regla</h2>
          <button onClick={onClose} className="text-steel-400 hover:text-steel-900">
            <X size={20} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
            Cuando ocurra
          </label>
          <select
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
          >
            {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
            Aplicar automáticamente
          </label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
          >
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {action === 'multa' && (
          <div>
            <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
              Monto de la multa (USD)
            </label>
            <input
              type="number"
              value={fineAmount}
              onChange={(e) => setFineAmount(e.target.value)}
              className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
            Días de gracia antes de aplicar
          </label>
          <input
            type="number"
            value={gracePeriodDays}
            onChange={(e) => setGracePeriodDays(e.target.value)}
            className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
            Descripción
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: Bloqueo automático tras 0 días de vencido"
            className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
          />
        </div>

        <button
          onClick={submit}
          disabled={saving}
          className="w-full bg-safety-500 hover:bg-safety-600 text-white font-semibold py-2.5 rounded transition-colors disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar regla'}
        </button>
      </div>
    </div>
  );
}
