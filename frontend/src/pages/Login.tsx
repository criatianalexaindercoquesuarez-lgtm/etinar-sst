import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('Correo o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-steel-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-9 h-9 bg-safety-500 flex items-center justify-center font-display font-black text-white text-lg">
              E
            </div>
            <span className="font-display text-2xl font-black text-white tracking-tight">
              SST ETINAR
            </span>
          </div>
          <p className="text-steel-400 text-sm">
            Sistema Inteligente de Gestión Documental
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-steel-900 border border-steel-700 rounded-lg p-8 space-y-5"
        >
          <div>
            <label className="block text-xs font-semibold text-steel-400 uppercase tracking-wide mb-1.5">
              Correo electrónico
            </label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-steel-800 border border-steel-600 rounded px-3 py-2.5 text-white placeholder-steel-400 focus:outline-none focus:ring-2 focus:ring-safety-500"
              placeholder="tu@empresa.com"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-steel-400 uppercase tracking-wide mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-steel-800 border border-steel-600 rounded px-3 py-2.5 text-white placeholder-steel-400 focus:outline-none focus:ring-2 focus:ring-safety-500"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-rojo-600 bg-rojo-100 text-sm px-3 py-2 rounded">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-safety-500 hover:bg-safety-600 text-white font-semibold py-2.5 rounded transition-colors disabled:opacity-60"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
