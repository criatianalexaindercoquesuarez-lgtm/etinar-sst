import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  FileCheck2,
  ScrollText,
  ShieldAlert,
  LogOut,
} from 'lucide-react';
import { useAuth, ROLE_LABELS } from '../lib/auth';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: null },
  { to: '/proyectos', label: 'Proyectos', icon: Building2, roles: null },
  {
    to: '/contratistas',
    label: 'Contratistas',
    icon: Users,
    roles: ['admin', 'coordinador_sst', 'director'],
  },
  {
    to: '/revision',
    label: 'Revisión Documental',
    icon: FileCheck2,
    roles: ['admin', 'coordinador_sst'],
  },
  {
    to: '/sanciones',
    label: 'Sanciones y Multas',
    icon: ShieldAlert,
    roles: ['admin'],
  },
  {
    to: '/auditoria',
    label: 'Auditoría',
    icon: ScrollText,
    roles: ['admin', 'coordinador_sst', 'director'],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  return (
    <div className="min-h-screen flex bg-steel-50">
      <aside className="w-64 bg-steel-900 text-white flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-steel-700 flex items-center gap-2">
          <div className="w-8 h-8 bg-safety-500 flex items-center justify-center font-display font-black text-sm">
            E
          </div>
          <div>
            <div className="font-display font-black text-sm tracking-tight leading-none">
              SST ETINAR
            </div>
            <div className="text-[10px] text-steel-400 mt-0.5">
              Gestión Documental
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-safety-500 text-white'
                    : 'text-steel-200 hover:bg-steel-800'
                }`
              }
            >
              <item.icon size={17} strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-steel-700">
          <div className="px-3 mb-2">
            <div className="text-sm font-semibold truncate">{user?.fullName}</div>
            <div className="text-xs text-steel-400">
              {user ? ROLE_LABELS[user.role] : ''}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm font-medium text-steel-200 hover:bg-steel-800 transition-colors"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
