/** Calendar helpers (local time, weeks starting on Sunday as in Brazilian calendars). */

export const WEEKDAYS = [
  { short: 'D', long: 'domingo' },
  { short: 'S', long: 'segunda-feira' },
  { short: 'T', long: 'terça-feira' },
  { short: 'Q', long: 'quarta-feira' },
  { short: 'Q', long: 'quinta-feira' },
  { short: 'S', long: 'sexta-feira' },
  { short: 'S', long: 'sábado' },
] as const;

const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const dayFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const summaryFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export interface MonthRef {
  year: number;
  /** 0 = January. */
  month: number;
}

/** 42 days (6 weeks) covering the month, starting on the Sunday on or before the 1st. */
export function monthGrid({ year, month }: MonthRef): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export const addMonths = ({ year, month }: MonthRef, delta: number): MonthRef => {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
};

export const monthOf = (date: Date): MonthRef => ({ year: date.getFullYear(), month: date.getMonth() });

export const sameDay = (a: Date | null, b: Date | null): boolean =>
  !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const addDays = (date: Date, days: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours(), date.getMinutes());

/** Keeps the day of `day` and the time of `time`. */
export const withTime = (day: Date, hours: number, minutes: number): Date =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);

export const monthTitle = (ref: MonthRef): string => {
  const text = monthFormatter.format(new Date(ref.year, ref.month, 1));
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const dayLabel = (date: Date): string => dayFormatter.format(date);

/** "sex., 20 de nov. de 2026 às 19:00" */
export const summary = (date: Date): string =>
  `${summaryFormatter.format(date)} às ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/** Wraps around the clock: 23 + 1 = 0, 0 - 1 = 23 (minutes in steps). */
export const stepTime = (value: number, step: number, size: number): number => (((value + step) % size) + size) % size;
