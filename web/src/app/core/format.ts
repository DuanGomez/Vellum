/** Fechas, horas y dinero en español de Colombia. Todo en hora local del negocio. */

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export function cop(n: number | null | undefined): string {
  return money.format(n ?? 0).replace(/\s/g, ' ');
}

/** "2026-11-05" de una fecha local. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Fecha local a partir de "2026-11-05" o "2026-11-05 14:30". */
export function parse(s: string): Date {
  const [d, t = '00:00'] = s.split(' ');
  const [y, m, day] = d.split('-').map(Number);
  const [h, min] = t.split(':').map(Number);
  return new Date(y, m - 1, day, h, min);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** "jueves 5 de noviembre" */
export function longDate(d: Date | string): string {
  const x = typeof d === 'string' ? parse(d) : d;
  return `${DAYS[x.getDay()]} ${x.getDate()} de ${MONTHS[x.getMonth()]}`;
}

/** "jue 5 nov" */
export function shortDate(d: Date | string): string {
  const x = typeof d === 'string' ? parse(d) : d;
  return `${DAYS_SHORT[x.getDay()]} ${x.getDate()} ${MONTHS_SHORT[x.getMonth()]}`;
}

export function dayName(d: Date): string {
  return DAYS_SHORT[d.getDay()];
}

export function monthName(m: number): string {
  return MONTHS[m];
}

/** "2:30 p. m." de "14:30" o de una fecha. */
export function hour(t: string | Date): string {
  let h: number;
  let m: number;
  if (typeof t === 'string') {
    const part = t.includes(' ') ? t.split(' ')[1] : t;
    [h, m] = part.split(':').map(Number);
  } else {
    h = t.getHours();
    m = t.getMinutes();
  }
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/** "1 h 15 min" */
export function duration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function minutesOf(t: string): number {
  const part = t.includes(' ') ? t.split(' ')[1] : t;
  const [h, m] = part.split(':').map(Number);
  return h * 60 + m;
}

export function initials(name: string): string {
  return name
    .replace(/^(Dra?\.)\s*/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** Día de la semana ISO (1 = lunes … 7 = domingo). */
export function isoWeekday(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

/** "+57 300 123 4567" a partir de "573001234567" o "3001234567". */
export function phone(raw: string | null | undefined): string {
  const d = (raw ?? '').replace(/\D/g, '');
  const local = d.length === 12 && d.startsWith('57') ? d.slice(2) : d;
  if (local.length === 10) return `+57 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  return raw ?? '';
}
