import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface AuditEntry {
  id: string;
  action: string;
  userEmail: string;
  entityType: string;
  details: string;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Inicio de sesión',
  PROJECT_CREATE: 'Proyecto creado',
  PROJECT_UPDATE: 'Proyecto actualizado',
  CONTRACTOR_CREATE: 'Contratista creado',
  CONTRACTOR_UPDATE: 'Contratista actualizado',
  CONTRACTOR_ASSIGN_PROJECT: 'Contratista asignado a proyecto',
  DOCUMENT_UPLOAD: 'Documento cargado',
  DOCUMENT_APROBAR: 'Documento aprobado',
  DOCUMENT_OBSERVAR: 'Documento observado',
  DOCUMENT_RECHAZAR: 'Documento rechazado',
  SANCTION_APPLIED: 'Sanción aplicada automáticamente',
};

export default function Audit() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);

  useEffect(() => {
    api.get('/audit').then((r) => setLogs(r.data));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-black text-steel-900 tracking-tight">
          Bitácora de Auditoría
        </h1>
        <p className="text-steel-600 text-sm mt-1">
          Registro inmutable de todas las acciones del sistema — no se pueden eliminar registros
        </p>
      </header>

      <div className="bg-white border border-steel-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-steel-50 text-steel-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-6 py-2.5 font-semibold">Fecha / hora</th>
              <th className="text-left px-6 py-2.5 font-semibold">Usuario</th>
              <th className="text-left px-6 py-2.5 font-semibold">Acción</th>
              <th className="text-left px-6 py-2.5 font-semibold">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-steel-100">
                <td className="px-6 py-3 text-steel-500 text-xs font-mono whitespace-nowrap">
                  {new Date(l.createdAt).toLocaleString('es-EC')}
                </td>
                <td className="px-6 py-3 text-steel-700">{l.userEmail}</td>
                <td className="px-6 py-3">
                  <span className="text-xs font-semibold bg-steel-100 text-steel-700 px-2 py-0.5 rounded">
                    {ACTION_LABELS[l.action] ?? l.action}
                  </span>
                </td>
                <td className="px-6 py-3 text-steel-600">{l.details}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-6 text-steel-400 text-center">
                  Aún no hay registros de auditoría.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
