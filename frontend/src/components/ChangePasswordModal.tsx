import { useState, type FormEvent } from 'react';
import { X, Check } from 'lucide-react';
import { api } from '../lib/api';

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las dos contraseñas nuevas no coinciden.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setSuccess(true);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || 'No se pudo cambiar la contraseña. Verifica la actual.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-steel-950/60 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg w-full max-w-sm p-6 text-center space-y-3">
          <Check className="mx-auto text-verde-600" size={32} />
          <h2 className="font-semibold text-steel-900">Contraseña actualizada</h2>
          <p className="text-sm text-steel-600">
            La próxima vez que inicies sesión, usa tu nueva contraseña.
          </p>
          <button
            onClick={onClose}
            className="w-full bg-safety-500 hover:bg-safety-600 text-white font-semibold py-2.5 rounded transition-colors"
          >
            Listo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-steel-950/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-steel-900">Cambiar mi contraseña</h2>
          <button onClick={onClose} className="text-steel-400 hover:text-steel-900">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
              Contraseña actual
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
              Nueva contraseña
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-steel-600 uppercase tracking-wide mb-1.5">
              Repite la nueva contraseña
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-steel-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-safety-500"
            />
          </div>

          {error && <p className="text-rojo-600 bg-rojo-100 text-sm px-3 py-2 rounded">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-safety-500 hover:bg-safety-600 text-white font-semibold py-2.5 rounded transition-colors disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
