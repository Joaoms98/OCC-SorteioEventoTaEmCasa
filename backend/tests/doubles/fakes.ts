import type { Clock } from '../../src/application/ports/Clock.ts';
import type { EmailDelivery, EmailSender, VerificationCodeEmail } from '../../src/application/ports/EmailSender.ts';
import type { IdGenerator } from '../../src/application/ports/IdGenerator.ts';
import type { RandomNumberGenerator } from '../../src/application/ports/RandomNumberGenerator.ts';
import type { TransactionManager } from '../../src/application/ports/TransactionManager.ts';

/** Generates valid, predictable v4-shaped UUIDs: 00000000-0000-4000-8000-000000000001, ... */
export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  generate(): string {
    this.counter += 1;
    return `00000000-0000-4000-8000-${this.counter.toString().padStart(12, '0')}`;
  }
}

/** Starts at a fixed instant and advances one second per call, so ordering by time is deterministic. */
export class SteppingClock implements Clock {
  private current: number;

  constructor(start = new Date('2026-10-01T12:00:00.000Z')) {
    this.current = start.getTime();
  }

  now(): Date {
    const date = new Date(this.current);
    this.current += 1000;
    return date;
  }
}

/** Returns queued values (0 when the queue is empty) and records every requested range. */
export class FakeRandomNumberGenerator implements RandomNumberGenerator {
  readonly requestedRanges: number[] = [];
  private readonly queue: number[];

  constructor(values: number[] = []) {
    this.queue = [...values];
  }

  enqueue(...values: number[]): void {
    this.queue.push(...values);
  }

  nextInt(maxExclusive: number): number {
    this.requestedRanges.push(maxExclusive);
    const value = this.queue.shift() ?? 0;
    if (value < 0 || value >= maxExclusive) throw new Error(`Fake random value ${value} out of [0, ${maxExclusive})`);
    return value;
  }
}

export class PassThroughTransactionManager implements TransactionManager {
  run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}

/** Keeps every e-mail "sent", so tests can read the codes; can be switched to failing. */
export class FakeEmailSender implements EmailSender {
  readonly sent: VerificationCodeEmail[] = [];
  failing = false;

  async sendVerificationCode(email: VerificationCodeEmail): Promise<EmailDelivery> {
    if (this.failing) throw new Error('provider down');
    this.sent.push(email);
    return {};
  }

  lastCodeFor(address: string): string {
    const email = this.sent.filter((item) => item.to === address).at(-1);
    if (!email) throw new Error(`No e-mail sent to ${address}`);
    return email.code;
  }
}

/** Clock whose time only moves when the test says so. */
export class ManualClock implements Clock {
  constructor(private current = new Date('2026-10-01T12:00:00.000Z')) {}

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
