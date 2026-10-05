import type { Clock } from '../../application/ports/Clock.ts';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
