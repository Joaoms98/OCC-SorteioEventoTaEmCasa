import { describe, expect, it } from 'vitest';
import { escapeCell } from '../csv';

describe('escapeCell', () => {
  it.each([
    ['=HYPERLINK("http://evil","x")', `"'=HYPERLINK(""http://evil"",""x"")"`],
    ['+cmd|calc', "'+cmd|calc"],
    ['-2+3', "'-2+3"],
    ['@SUM(A1)', "'@SUM(A1)"],
  ])('neutralizes formulas: %s', (value, expected) => {
    expect(escapeCell(value)).toBe(expected);
  });

  it('quotes separators and line breaks', () => {
    expect(escapeCell('Silva; Maria')).toBe('"Silva; Maria"');
    expect(escapeCell('linha\r\nnova')).toBe('"linha\r\nnova"');
  });

  it('keeps regular values untouched', () => {
    expect(escapeCell('Maria Silva')).toBe('Maria Silva');
    expect(escapeCell('(11) 98765-4321')).toBe('(11) 98765-4321');
  });
});
