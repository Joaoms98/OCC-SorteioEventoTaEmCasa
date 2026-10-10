import { beforeEach, describe, expect, it } from 'vitest';
import { VERIFICATION_RULES } from '../../../src/domain/entities/RegistrationVerification.ts';
import { ErrorCode } from '../../../src/domain/errors/ErrorCode.ts';
import { ManualClock } from '../../doubles/fakes.ts';
import { makeTestUseCases } from '../../doubles/makeTestUseCases.ts';

describe('Registration with e-mail code', () => {
  let ctx: ReturnType<typeof makeTestUseCases>;
  let clock: ManualClock;
  let eventId: string;
  const data = { name: 'Ana Lima', phone: '(11) 98765-4321', email: 'Ana@Mail.com' };

  beforeEach(async () => {
    clock = new ManualClock();
    ctx = makeTestUseCases({ clock });
    eventId = (await ctx.useCases.createEvent.execute({ name: 'Tá em Casa', registrationOpen: true })).id;
  });

  const start = (overrides: Partial<typeof data> = {}) =>
    ctx.useCases.startRegistration.execute({ eventId, ...data, ...overrides });
  const confirm = (verificationId: string, code: string) =>
    ctx.useCases.confirmRegistration.execute({ eventId, verificationId, code });
  const codeFor = (email = 'ana@mail.com') => ctx.emails.lastCodeFor(email);
  const wrong = (code: string) => (code === '000000' ? '111111' : '000000');

  it('creates the participant only after the right code, with normalized contacts', async () => {
    ctx.random.enqueue(42);
    const { verification, previewCode } = await start();

    expect(previewCode).toBeNull();
    expect(ctx.emails.sent[0]).toMatchObject({ to: 'ana@mail.com', code: '000042', expiresInMinutes: 10 });
    expect(verification.codeHash).not.toContain('000042');
    expect(ctx.db.participants.size).toBe(0);

    const { participant } = await confirm(verification.id, '000042');
    expect(participant).toMatchObject({ name: 'Ana Lima', phone: '11987654321', email: 'ana@mail.com' });
    expect(ctx.verifications.items.size).toBe(0);
  });

  it('requires an e-mail and refuses contacts already registered', async () => {
    await expect(start({ email: '  ' })).rejects.toMatchObject({ code: ErrorCode.EmailRequired });
    await ctx.useCases.addParticipant.execute({ eventId, name: 'Outra', phone: '11987654321' });
    await expect(start()).rejects.toMatchObject({ code: ErrorCode.ParticipantAlreadyRegistered, details: { field: 'phone' } });
    expect(ctx.emails.sent).toHaveLength(0);
  });

  it('expires the code after 10 minutes', async () => {
    const { verification } = await start();
    clock.advance(VERIFICATION_RULES.codeTtlMs);
    await expect(confirm(verification.id, codeFor())).rejects.toMatchObject({ code: ErrorCode.VerificationExpired });
  });

  it('counts wrong codes and locks after 5 of them', async () => {
    const { verification } = await start();
    const code = codeFor();
    for (let left = 4; left >= 1; left--) {
      await expect(confirm(verification.id, wrong(code))).rejects.toMatchObject({
        code: ErrorCode.InvalidVerificationCode,
        details: { attemptsLeft: left },
      });
    }
    await expect(confirm(verification.id, wrong(code))).rejects.toMatchObject({ code: ErrorCode.TooManyVerificationAttempts });
    await expect(confirm(verification.id, code)).rejects.toMatchObject({ code: ErrorCode.TooManyVerificationAttempts });
  });

  it('resends a new code after the cooldown, a limited number of times, unlocking the attempts', async () => {
    const { verification } = await start();
    const first = codeFor();
    for (let i = 0; i < 5; i++) await confirm(verification.id, wrong(first)).catch(() => undefined);

    const resend = () => ctx.useCases.resendRegistrationCode.execute({ eventId, verificationId: verification.id });
    await expect(resend()).rejects.toMatchObject({ code: ErrorCode.VerificationResendTooSoon, details: { secondsLeft: 60 } });

    clock.advance(VERIFICATION_RULES.resendCooldownMs);
    ctx.random.enqueue(7);
    await resend();
    expect(codeFor()).toBe('000007');
    await expect(confirm(verification.id, first === '000007' ? '999999' : first)).rejects.toMatchObject({
      code: ErrorCode.InvalidVerificationCode,
    });

    for (let sends = 2; sends < VERIFICATION_RULES.maxSends; sends++) {
      clock.advance(VERIFICATION_RULES.resendCooldownMs);
      await resend();
    }
    clock.advance(VERIFICATION_RULES.resendCooldownMs);
    await expect(resend()).rejects.toMatchObject({ code: ErrorCode.VerificationResendLimit });
    expect((await confirm(verification.id, codeFor())).participant).toMatchObject({ name: 'Ana Lima' });
  });

  it('limits how many registrations can be started for one e-mail per hour', async () => {
    for (let i = 0; i < 3; i++) await start();
    await expect(start()).rejects.toMatchObject({ code: ErrorCode.TooManyVerificationsForEmail });
    clock.advance(60 * 60 * 1000 + 1000);
    await expect(start()).resolves.toBeDefined();
  });

  it('keeps nothing when the e-mail cannot be sent', async () => {
    ctx.emails.failing = true;
    await expect(start()).rejects.toMatchObject({ code: ErrorCode.EmailDeliveryFailed, kind: 'UNAVAILABLE' });
    expect(ctx.verifications.items.size).toBe(0);
  });

  it('refuses the code when someone took the phone meanwhile or registration closed', async () => {
    const { verification } = await start();
    await ctx.useCases.addParticipant.execute({ eventId, name: 'Rápida', phone: '11987654321' });
    await expect(confirm(verification.id, codeFor())).rejects.toMatchObject({ code: ErrorCode.ParticipantAlreadyRegistered });

    const other = await start({ phone: '11911112222', email: 'outra@mail.com' });
    await ctx.useCases.updateEvent.execute({ eventId, changes: { registrationOpen: false } });
    await expect(confirm(other.verification.id, codeFor('outra@mail.com'))).rejects.toMatchObject({
      code: ErrorCode.RegistrationClosed,
    });
  });

  it('does not accept a verification from another event', async () => {
    const { verification } = await start();
    const otherEventId = (await ctx.useCases.createEvent.execute({ name: 'Outro', registrationOpen: true })).id;
    await expect(
      ctx.useCases.confirmRegistration.execute({ eventId: otherEventId, verificationId: verification.id, code: codeFor() }),
    ).rejects.toMatchObject({ code: ErrorCode.VerificationNotFound });
  });
});
