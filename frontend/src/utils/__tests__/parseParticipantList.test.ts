import { describe, expect, it } from 'vitest';
import { parseParticipantList } from '../parseParticipantList';

describe('parseParticipantList', () => {
  it('reads name, phone and e-mail in any order, ignoring blank lines and the header', () => {
    const text = 'Nome;Telefone;E-mail\nMaria Silva; (11) 98765-4321; maria@email.com\n\nJoão; joao@email.com; 21999990000\nAna';
    expect(parseParticipantList(text)).toEqual([
      { name: 'Maria Silva', phone: '(11) 98765-4321', email: 'maria@email.com' },
      { name: 'João', phone: '21999990000', email: 'joao@email.com' },
      { name: 'Ana' },
    ]);
  });

  it('accepts spreadsheet columns (tabs) and commas', () => {
    expect(parseParticipantList('Carlos\t11912345678\nBia, bia@email.com')).toEqual([
      { name: 'Carlos', phone: '11912345678' },
      { name: 'Bia', email: 'bia@email.com' },
    ]);
  });
});
