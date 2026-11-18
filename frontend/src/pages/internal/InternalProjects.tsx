import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FolderOpen, Plus, Users, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { Bar, Card, Empty, Modal, Pct, btnPrimary, inputCls, DISCIPLINE_SHORT, fmtDateTime } from './shared';

export default function InternalProjects() {
  const [data, setData] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/internal/projects').then((r) => setData(r.data));
  }, []);

  if (!data) return <p className="text-steel-400">Cargando obras…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-steel-600">Obras con seguimiento interno: carpetas de OneDrive vinculadas y personal asignado.</p>
        {data.available.length > 0 && (
          <button className={btnPrimary} onClick={() => setAdding(true)}>
            <Plus size={16} /> Agregar obra al seguimiento
          </button>
        )}
      </div>

      {data.projects.length === 0 && (
        <Card>
          <Empty>Ninguna obra tiene seguimiento interno todavía.</Empty>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {data.projects.map((p: any) => (
          <Link key={p.id} to={`/interna/obras/${p.id}`} className="bg-white border border-steel-200 rounded-lg p-5 hover:border-safety-400 transition-colors block">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-xl font-black text-steel-900">{p.code}</div>
                <div className="text-sm text-steel-600">
                  {p.name} · {p.city}
                </div>
              </div>
              {p.alerts > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-rojo-600 bg-rojo-100 px-2 py-1 rounded">
                  <AlertTriangle size={12} /> {p.alerts}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <div className="text-xs text-steel-400 mb-1">Actividades (90 días)</div>
                <Pct value={p.last90.pct} />
                <Bar value={p.last90.pct} />
              </div>
              <div>
                <div className="text-xs text-steel-400 mb-1">Matriz AM 196</div>
                <Pct value={p.am196.pct} />
                <Bar value={p.am196.pct} />
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-xs text-steel-600">
              <span className="inline-flex items-center gap-1">
                <Users size={13} />
                {p.staff.length ? p.staff.map((s: any) => `${s.name} (${DISCIPLINE_SHORT[s.discipline]})`).join(', ') : 'Sin personal asignado'}
              </span>
              <span className="inline-flex items-center gap-1">
                <FolderOpen size={13} />
                {p.links.length ? `${p.links.length} carpeta(s) · ${p.links.reduce((a: number, l: any) => a + (l.itemCount || 0), 0)} archivos · ${fmtDateTime(p.links.map((l: any) => l.lastScanAt).filter(Boolean).sort().pop())}` : 'Sin carpeta de OneDrive'}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {adding && (
        <Modal title="Agregar obra al seguimiento interno" onClose={() => setAdding(false)}>
          <p className="text-sm text-steel-600 mb-3">Elige la obra. En el siguiente paso vinculas sus carpetas de OneDrive y asignas a los asistentes.</p>
          <select className={inputCls} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Selecciona…</option>
            {data.available.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
          <button className={`${btnPrimary} mt-4`} disabled={!pick} onClick={() => navigate(`/interna/obras/${pick}?nuevo=1`)}>
            Continuar
          </button>
        </Modal>
      )}
    </div>
  );
}
