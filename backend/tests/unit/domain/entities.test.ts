import { describe, expect, it } from 'vitest';
import { Draw, DrawStatus } from '../../../src/domain/entities/Draw.ts';
import { DrawMode, Event } from '../../../src/domain/entities/Event.ts';
import { Participant } from '../../../src/domain/entities/Participant.ts';
import { Prize } from '../../../src/domain/entities/Prize.ts';
import { ErrorCode } from '../../../src/domain/errors/ErrorCode.ts';

const now = new Date('2026-10-01T12:00:00Z');
const later = new Date('2026-10-01T13:00:00Z');

describe('Event', () => {
  it('normalizes the name and starts with registration closed', () => {
    const event = Event.create({ id: 'e1', name: '  Tá   em Casa  ', now });
    expect(event.name).toBe('Tá em Casa');
    expect(event.registrationOpen).toBe(false);
    expect(() => event.ensureRegistrationOpen()).toThrow(expect.objectContaining({ code: ErrorCode.RegistrationClosed }));
  });

  it('rejects empty names', () => {
    expect(() => Event.create({ id: 'e1', name: '   ', now })).toThrow(
      expect.objectContaining({ code: ErrorCode.InvalidEventName }),
    );
  });

  it('applies partial updates and refreshes updatedAt', () => {
    const event = Event.create({ id: 'e1', name: 'Evento', description: 'Desc', now });
    event.update({ registrationOpen: true, description: null }, later);
    expect(event.registrationOpen).toBe(true);
    expect(event.description).toBeNull();
    expect(event.name).toBe('Evento');
    expect(event.updatedAt).toBe(later);
  });

  it('spins the prize roulette unless the participant roulette is chosen', () => {
    const event = Event.create({ id: 'e1', name: 'Evento', now });
    expect(event.drawMode).toBe(DrawMode.Prizes);
    event.update({ drawMode: DrawMode.Participants }, later);
    expect(event.drawMode).toBe(DrawMode.Participants);
    expect(Event.create({ id: 'e2', name: 'Outro', drawMode: DrawMode.Participants, now }).drawMode).toBe(DrawMode.Participants);
  });
});

describe('Participant', () => {
  it('normalizes contacts', () => {
    const participant = Participant.create({
      id: 'p1',
      eventId: 'e1',
      name: 'Ana',
      phone: '(21) 99999-0000',
      email: 'ANA@MAIL.COM',
      now,
    });
    expect(participant.phone).toBe('21999990000');
    expect(participant.email).toBe('ana@mail.com');
  });
});

describe('Prize', () => {
  const create = (quantity: number) => Prize.create({ id: 'pr1', eventId: 'e1', name: 'Kit', quantity, now });

  it.each([0, -1, 1.5, 10_001])('rejects quantity %s', (quantity) => {
    expect(() => create(quantity)).toThrow(expect.objectContaining({ code: ErrorCode.InvalidPrizeQuantity }));
  });

  it('tracks remaining units and stock', () => {
    const prize = create(2);
    expect(prize.remainingUnits(1)).toBe(1);
    expect(() => prize.ensureAvailable(1)).not.toThrow();
    expect(() => prize.ensureAvailable(2)).toThrow(expect.objectContaining({ code: ErrorCode.PrizeOutOfStock }));
  });

  it('cannot lower the quantity below the drawn units and stays untouched on failure', () => {
    const prize = create(5);
    expect(() => prize.update({ quantity: 2, name: 'Outro' }, 3, later)).toThrow(
      expect.objectContaining({ code: ErrorCode.PrizeQuantityBelowDrawn, details: { drawnUnits: 3 } }),
    );
    expect(prize.quantity).toBe(5);
    expect(prize.name).toBe('Kit');
  });
});

describe('Draw claims', () => {
  const create = () => Draw.create({ id: 'd1', eventId: 'e1', prizeId: 'pr1', participantId: 'p1', now });

  it('records when the prize was handed over, only once', () => {
    const draw = create();
    draw.markAsClaimed(later);
    expect(draw.claimedAt).toBe(later);
    expect(() => draw.markAsClaimed(later)).toThrow(expect.objectContaining({ code: ErrorCode.PrizeAlreadyClaimed }));
  });

  it('cannot claim a voided draw nor void a claimed one', () => {
    const voided = create();
    voided.markAsVoided(later);
    expect(() => voided.markAsClaimed(later)).toThrow(expect.objectContaining({ code: ErrorCode.DrawAlreadyVoided }));

    const claimed = create();
    claimed.markAsClaimed(later);
    expect(() => claimed.markAsVoided(later)).toThrow(expect.objectContaining({ code: ErrorCode.PrizeAlreadyClaimed }));
    expect(claimed.status).toBe(DrawStatus.Confirmed);
  });
});

describe('Draw', () => {
  it('can be voided only once', () => {
    const draw = Draw.create({ id: 'd1', eventId: 'e1', prizeId: 'pr1', participantId: 'p1', now });
    expect(draw.status).toBe(DrawStatus.Confirmed);

    draw.markAsVoided(later);
    expect(draw.status).toBe(DrawStatus.Voided);
    expect(draw.voidedAt).toBe(later);
    expect(() => draw.markAsVoided(later)).toThrow(expect.objectContaining({ code: ErrorCode.DrawAlreadyVoided }));
  });
});
