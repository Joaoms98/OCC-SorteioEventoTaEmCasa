// Cells starting with these characters are run as formulas by Excel/Sheets (CSV injection).
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/** Neutralizes formulas and quotes cells containing separators, quotes or line breaks. */
export function escapeCell(value: string): string {
  const safe = FORMULA_TRIGGER.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Downloads a ";"-separated CSV with BOM so Excel (pt-BR) opens accents and columns correctly. */
export function downloadCsv(filename: string, header: string[], rows: string[][]): void {
  const content = [header, ...rows].map((row) => row.map(escapeCell).join(';')).join('\r\n');
  const blob = new Blob([`﻿${content}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
