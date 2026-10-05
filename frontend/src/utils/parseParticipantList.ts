import type { ParticipantInput } from '../types/api';

const HEADER = /^\s*nome\b/i;

/**
 * Parses pasted text, one participant per line: "Nome; telefone; e-mail".
 * Separators can be ";", tab (columns pasted from a spreadsheet) or ",".
 * Phone and e-mail are optional and may come in any order after the name.
 */
export function parseParticipantList(text: string): ParticipantInput[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines[0] && HEADER.test(lines[0])) lines.shift();

  return lines.map((line) => {
    const parts = (/[;\t]/.test(line) ? line.split(/[;\t]/) : line.split(',')).map((part) => part.trim());
    const [name = '', ...rest] = parts;
    const entry: ParticipantInput = { name };
    for (const value of rest) {
      if (!value) continue;
      if (value.includes('@')) entry.email = value;
      else entry.phone = value;
    }
    return entry;
  });
}
