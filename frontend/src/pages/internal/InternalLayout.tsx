import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { CloudOff, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { btnSecondary, errMsg, fmtDateTime } from './shared';

const TABS = [
  { to: '/interna', label: 'Dashboard', end: true },
  { to: '/interna/obras', label: 'Obras' },
  { to: '/interna/actividades', label: 'Actividades' },
  { to: '/interna/am196', label: 'Matriz AM 196' },
  { to: '/interna/personal', label: 'Personal' },
  { to: '/interna/alertas', label: 'Alertas' },
  { to: '/interna/configuracion', label: 'Reportes y configuración', roles: ['admin', 'coordinador_sst', 'director'] },
];

export default function InternalLayout() {
  const { user } = useAuth();
  const [status, setStatus] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const canRun = user && ['admin', 'coordinador_sst'].includes(user.role);

  function load() {
    api.get('/internal/status').then((r) => setStatus(r.data)).catch(() => {});
  }
  useEffect(load, []);

  async function runNow() {
    setRunning(true);
    try {
      await api.post('/internal/run', { scan: true });
      load();
      window.dispatchEvent(new Event('internal:refresh'));
    } catch (e) {
      alert(errMsg(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold tracking-widest text-safety-500">ETINAR · COORDINACIÓN SST</div>
          <h1 className="font-display text-3xl font-black text-steel-900 tracking-tight">Documentación Interna ETINAR</h1>
          <p className="text-steel-600 text-sm mt-1">
            Seguimiento de asistentes SST, Ambiente, Médicos y Social por obra, vinculado a OneDrive · Matriz AM 196
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status && (
            <div className="text-xs text-steel-600 text-right">
              {status.azureConfigured ? (
                <>
                  OneDrive: {status.linksOk}/{status.links} carpetas OK{status.linksError ? ` · ${status.linksError} con error` : ''}
                  <br />
                  Última lectura: {fmtDateTime(status.lastScanAt)}
                </>
              ) : (
                <span className="inline-flex items-center gap-1 text-amarillo-600 font-semibold">
                  <CloudOff size={14} /> Microsoft 365 sin configurar
                </span>
              )}
            </div>
          )}
          {canRun && (
            <button className={btnSecondary} onClick={runNow} disabled={running} title="Lee OneDrive y recalcula todo ahora">
              <RefreshCw size={15} className={running ? 'animate-spin' : ''} />
              {running ? 'Sincronizando…' : 'Sincronizar ahora'}
            </button>
          )}
        </div>
      </header>

      {status && !status.azureConfigured && canRun && (
        <div className="bg-amarillo-100 border border-amarillo-600/30 text-amarillo-600 text-sm rounded p-3">
          La conexión con OneDrive/SharePoint aún no está activa. Puedes registrar obras, personal y enlaces de carpetas; la lectura y escritura en OneDrive empezará al configurar las credenciales de Azure AD (ver "Reportes y configuración").
        </div>
      )}

      <nav className="flex flex-wrap gap-1 border-b border-steel-200">
        {TABS.filter((t) => !t.roles || (user && t.roles.includes(user.role))).map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `px-3.5 py-2 text-sm font-medium border-b-2 -mb-px ${isActive ? 'border-safety-500 text-steel-900' : 'border-transparent text-steel-600 hover:text-steel-900'}`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
