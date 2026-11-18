import type { Frequency } from './internal.entities';

/**
 * Utilidades de fechas en hora de Ecuador continental (UTC-5, sin horario de
 * verano). Todas las fechas de negocio se manejan como 'YYYY-MM-DD'.
 */
const EC_OFFSET_MS = 5 * 60 * 60 * 1000;

export function ecToday(now = new Date()): string {
  return new Date(now.getTime() - EC_OFFSET_MS).toISOString().slice(0, 10);
}

/** Fecha (YYYY-MM-DD, hora Ecuador) de un instante. */
export function ecDate(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const t = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(t.getTime())) return null;
  return new Date(t.getTime() - EC_OFFSET_MS).toISOString().slice(0, 10);
}

function parse(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}
function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(s: string, n: number): string {
  const d = parse(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parse(a).getTime() - parse(b).getTime()) / 86400000);
}

/** 1 = lunes … 7 = domingo */
export function isoWeekday(s: string): number {
  const d = parse(s).getUTCDay();
  return d === 0 ? 7 : d;
}

function isoWeek(s: string): { year: number; week: number } {
  const d = parse(s);
  const day = isoWeekday(s);
  d.setUTCDate(d.getUTCDate() + 4 - day); // jueves de la misma semana
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function lastDayOfMonth(y: number, m: number): string {
  return fmt(new Date(Date.UTC(y, m, 0)));
}

export interface Period {
  key: string;
  start: string;
  end: string;
}

export function periodFor(freq: Frequency, date: string): Period {
  const [y, m, d] = date.split('-').map(Number);
  const mm = String(m).padStart(2, '0');
  switch (freq) {
    case 'semanal': {
      const start = addDays(date, 1 - isoWeekday(date));
      const { year, week } = isoWeek(date);
      return { key: `${year}-S${String(week).padStart(2, '0')}`, start, end: addDays(start, 6) };
    }
    case 'quincenal':
      return d <= 15
        ? { key: `${y}-${mm}-Q1`, start: `${y}-${mm}-01`, end: `${y}-${mm}-15` }
        : { key: `${y}-${mm}-Q2`, start: `${y}-${mm}-16`, end: lastDayOfMonth(y, m) };
    case 'mensual':
      return { key: `${y}-${mm}`, start: `${y}-${mm}-01`, end: lastDayOfMonth(y, m) };
    case 'trimestral': {
      const q = Math.floor((m - 1) / 3);
      const sm = q * 3 + 1;
      return {
        key: `${y}-T${q + 1}`,
        start: `${y}-${String(sm).padStart(2, '0')}-01`,
        end: lastDayOfMonth(y, sm + 2),
      };
    }
    case 'semestral': {
      const h = m <= 6 ? 1 : 2;
      return h === 1
        ? { key: `${y}-H1`, start: `${y}-01-01`, end: `${y}-06-30` }
        : { key: `${y}-H2`, start: `${y}-07-01`, end: `${y}-12-31` };
    }
    case 'anual':
    default:
      return { key: `${y}`, start: `${y}-01-01`, end: `${y}-12-31` };
  }
}

/** Todos los períodos que se cruzan con [from, to], en orden. */
export function periodsBetween(freq: Frequency, from: string, to: string): Period[] {
  const out: Period[] = [];
  let p = periodFor(freq, from);
  while (p.start <= to) {
    out.push(p);
    p = periodFor(freq, addDays(p.end, 1));
  }
  return out;
}

export function previousWeek(today = ecToday()): Period {
  return periodFor('semanal', addDays(today, -7));
}

export function previousMonth(today = ecToday()): Period {
  const first = today.slice(0, 8) + '01';
  return periodFor('mensual', addDays(first, -1));
}

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function humanDate(s: string | null | undefined): string {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Texto normalizado: minúsculas, sin tildes, separadores como espacio. */
export function norm(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * ¿La ruta contiene alguna palabra clave?
 *  - Las opciones se separan con coma (basta que coincida una).
 *  - Dentro de una opción, "+" exige TODAS las palabras: "programa+psicosocial".
 *  - Un término con "-" delante excluye: "capacitaciones+-cronograma".
 *  - Las palabras cortas (≤4 letras, ej. "epp", "sut", "iper") deben aparecer
 *    como palabra completa para evitar falsos positivos.
 */
export function matchesKeywords(pathNorm: string, keywords: string | null | undefined): boolean {
  if (!keywords) return false;
  const has = (k: string) => {
    if (k.length <= 4) {
      return new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(pathNorm);
    }
    return pathNorm.includes(k);
  };
  // Un término que empieza con "-" EXCLUYE: "capacitaciones+-cronograma"
  return keywords
    .split(',')
    .map((opt) => opt.split('+').map((k) => norm(k.trim())).filter((k) => k && k !== '-'))
    .filter((terms) => terms.some((t) => !t.startsWith('-')))
    .some((terms) => terms.every((t) => (t.startsWith('-') ? !has(t.slice(1).trim()) : has(t))));
}

/** Nombres de carpeta típicos por disciplina (para no mezclar evidencias entre roles). */
export const DISCIPLINE_FOLDER_HINTS: Record<string, string[]> = {
  sst: ['sst', 'seguridad', 'ssoma', 'sso', 'hse'],
  ambiente: ['ambiente', 'ambiental', 'medio ambiente'],
  medico: ['medico', 'medica', 'medicina', 'enfermeria', 'dispensario', 'salud ocupacional'],
  social: ['social', 'comunidad', 'comunitario', 'comunitarias'],
};

/** ¿Alguna carpeta de la ruta (sin el nombre del archivo) corresponde a la disciplina? */
export function folderHasDiscipline(pathNorm: string, discipline: string): boolean {
  const folders = pathNorm.split('/').slice(0, -1);
  const hints = DISCIPLINE_FOLDER_HINTS[discipline] || [];
  return folders.some((f) => {
    const words = f.split(/[^a-z0-9]+/).filter(Boolean);
    return hints.some((h) => (h.includes(' ') ? f.includes(h) : words.includes(h)));
  });
}

export function semaphore(pct: number | null): 'verde' | 'amarillo' | 'rojo' | 'gris' {
  if (pct === null || pct === undefined) return 'gris';
  if (pct >= 90) return 'verde';
  if (pct >= 70) return 'amarillo';
  return 'rojo';
}
