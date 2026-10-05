import { describe, expect, it } from 'vitest';
import { ErrorCode } from '../../../src/domain/errors/ErrorCode.ts';
import { Email } from '../../../src/domain/value-objects/Email.ts';
import { Phone } from '../../../src/domain/value-objects/Phone.ts';

describe('Phone', () => {
  it.each([
    ['(11) 98765-4321', '11987654321'],
    ['11 3333-4444', '1133334444'],
    ['+55 11 98765-4321', '11987654321'],
    ['5511987654321', '11987654321'],
  ])('normalizes %s to %s', (raw, expected) => {
    expect(Phone.create(raw).value).toBe(expected);
  });

  it.each([
    ['too short', '123'],
    ['missing area code', '987654321'],
    ['too long', '119876543210000'],
    ['not a number', 'abc'],
    ['nonexistent area code', '(00) 98765-4321'],
    ['area code 20', '(20) 98765-4321'],
    ['mobile without leading 9', '(11) 88765-4321'],
    ['landline starting with 9', '(11) 9876-5432'],
  ])('rejects %s (%s)', (_reason, raw) => {
    expect(() => Phone.create(raw)).toThrow(expect.objectContaining({ code: ErrorCode.InvalidPhone }));
  });

  it('treats blank optional values as absent', () => {
    expect(Phone.createOptional('   ')).toBeNull();
    expect(Phone.createOptional(undefined)).toBeNull();
  });
});

describe('Email', () => {
  it('trims and lowercases', () => {
    expect(Email.create('  Maria@Example.COM ').value).toBe('maria@example.com');
  });

  it.each(['maria', 'maria@', '@example.com', 'maria @example.com'])('rejects %s', (raw) => {
    expect(() => Email.create(raw)).toThrow(expect.objectContaining({ code: ErrorCode.InvalidEmail }));
  });
});
