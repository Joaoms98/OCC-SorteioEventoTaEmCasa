import type { Clock } from '../../src/application/ports/Clock.ts';
import type { LiveDrawChannel } from '../../src/application/ports/LiveDrawChannel.ts';
import type { PasswordVerifier } from '../../src/application/ports/PasswordVerifier.ts';
import type { TokenService } from '../../src/application/ports/TokenService.ts';
import { InMemoryLiveDrawChannel } from '../../src/infrastructure/live/InMemoryLiveDrawChannel.ts';
import { HmacVerificationCodeHasher } from '../../src/infrastructure/security/HmacVerificationCodeHasher.ts';
import { makeUseCases } from '../../src/main/makeUseCases.ts';
import {
  FakeEmailSender,
  FakeRandomNumberGenerator,
  PassThroughTransactionManager,
  SequentialIdGenerator,
  SteppingClock,
} from './fakes.ts';
import { InMemoryDatabase } from './InMemoryDatabase.ts';
import {
  InMemoryDrawRepository,
  InMemoryEventRepository,
  InMemoryParticipantRepository,
  InMemoryPrizeImageRepository,
  InMemoryPrizeRepository,
  InMemoryRegistrationVerificationRepository,
} from './InMemoryRepositories.ts';

export const TEST_ADMIN_PASSWORD = 'correct-horse-battery';

const passwordVerifier: PasswordVerifier = { verify: (password) => password === TEST_ADMIN_PASSWORD };

const fakeTokens: TokenService = {
  issue: (subject) => ({ token: `token-for-${subject}`, expiresInSeconds: 3600 }),
  verify: (token) => (token.startsWith('token-for-') ? { subject: token.slice('token-for-'.length) } : null),
};

interface TestOverrides {
  tokens?: TokenService;
  /** Defaults to a live channel that reveals immediately, so draws can run back to back. */
  live?: LiveDrawChannel;
  clock?: Clock;
}

export function makeTestUseCases(overrides: TestOverrides = {}) {
  const db = new InMemoryDatabase();
  const random = new FakeRandomNumberGenerator();
  const emails = new FakeEmailSender();
  const verifications = new InMemoryRegistrationVerificationRepository();
  const live = overrides.live ?? new InMemoryLiveDrawChannel(new SteppingClock(), 0);
  const useCases = makeUseCases({
    events: new InMemoryEventRepository(db),
    participants: new InMemoryParticipantRepository(db),
    prizes: new InMemoryPrizeRepository(db),
    prizeImages: new InMemoryPrizeImageRepository(db),
    draws: new InMemoryDrawRepository(db),
    transaction: new PassThroughTransactionManager(),
    ids: new SequentialIdGenerator(),
    clock: overrides.clock ?? new SteppingClock(),
    random,
    passwordVerifier,
    tokens: overrides.tokens ?? fakeTokens,
    live,
    verifications,
    codeHasher: new HmacVerificationCodeHasher('test-secret'),
    emailSender: emails,
  });
  return { db, random, live, emails, verifications, useCases };
}
