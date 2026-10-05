const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
const timeFormatter = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' });

export const formatDateTime = (iso: string | null): string =>
  iso ? dateTimeFormatter.format(new Date(iso)) : 'Data a definir';
export const formatTime = (iso: string): string => timeFormatter.format(new Date(iso));

/** "11987654321" -> "(11) 98765-4321" */
export function formatPhone(digits: string | null): string {
  if (!digits) return '—';
  const match = /^(\d{2})(\d{4,5})(\d{4})$/.exec(digits);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : digits;
}

/** Progressive mask while typing a Brazilian phone number. */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export const pluralize = (count: number, singular: string, plural: string): string =>
  `${count.toLocaleString('pt-BR')} ${count === 1 ? singular : plural}`;
