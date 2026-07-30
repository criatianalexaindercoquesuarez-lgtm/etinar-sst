const STATUS_STYLES: Record<string, string> = {
  pendiente: 'bg-steel-200 text-steel-700',
  en_revision: 'bg-amarillo-100 text-amarillo-600',
  observado: 'bg-safety-100 text-safety-600',
  rechazado: 'bg-rojo-100 text-rojo-600',
  aprobado: 'bg-verde-100 text-verde-600',
  por_vencer: 'bg-amarillo-100 text-amarillo-600',
  vencido: 'bg-rojo-100 text-rojo-600',
  archivado: 'bg-steel-200 text-steel-600',
};

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  observado: 'Observado',
  rechazado: 'Rechazado',
  aprobado: 'Aprobado',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
  archivado: 'Archivado',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded text-xs font-semibold ${
        STATUS_STYLES[status] ?? 'bg-steel-200 text-steel-700'
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

const SEMAPHORE_COLORS: Record<string, string> = {
  verde: 'bg-verde-600',
  amarillo: 'bg-amarillo-600',
  rojo: 'bg-rojo-600',
};

export function Semaphore({ color }: { color: string }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${
        SEMAPHORE_COLORS[color] ?? 'bg-steel-400'
      }`}
    />
  );
}

const CONTRACTOR_STATUS_STYLES: Record<string, string> = {
  activo: 'bg-verde-100 text-verde-600',
  suspendido: 'bg-amarillo-100 text-amarillo-600',
  bloqueado: 'bg-rojo-100 text-rojo-600',
  inactivo: 'bg-steel-200 text-steel-600',
};

const CONTRACTOR_STATUS_LABELS: Record<string, string> = {
  activo: 'Activo',
  suspendido: 'Suspendido',
  bloqueado: 'Bloqueado',
  inactivo: 'Inactivo',
};

export function ContractorStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded text-xs font-semibold ${
        CONTRACTOR_STATUS_STYLES[status] ?? 'bg-steel-200 text-steel-700'
      }`}
    >
      {CONTRACTOR_STATUS_LABELS[status] ?? status}
    </span>
  );
}
