import { PrismaContext } from '../infrastructure/database/prisma/PrismaContext.ts';
import { PrismaTransactionManager } from '../infrastructure/database/prisma/PrismaTransactionManager.ts';
import { PrismaDrawRepository } from '../infrastructure/database/prisma/repositories/PrismaDrawRepository.ts';
import { PrismaEventRepository } from '../infrastructure/database/prisma/repositories/PrismaEventRepository.ts';
import { PrismaParticipantRepository } from '../infrastructure/database/prisma/repositories/PrismaParticipantRepository.ts';
import { PrismaPrizeImageRepository } from '../infrastructure/database/prisma/repositories/PrismaPrizeImageRepository.ts';
import { PrismaPrizeRepository } from '../infrastructure/database/prisma/repositories/PrismaPrizeRepository.ts';
import { PrismaRegistrationVerificationRepository } from '../infrastructure/database/prisma/repositories/PrismaRegistrationVerificationRepository.ts';
import { BrevoEmailSender } from '../infrastructure/email/BrevoEmailSender.ts';
import { ConsoleEmailSender } from '../infrastructure/email/ConsoleEmailSender.ts';
import { HmacVerificationCodeHasher } from '../infrastructure/security/HmacVerificationCodeHasher.ts';
import { InMemoryLiveDrawChannel } from '../infrastructure/live/InMemoryLiveDrawChannel.ts';
import { JwtTokenService } from '../infrastructure/security/JwtTokenService.ts';
import { StaticPasswordVerifier } from '../infrastructure/security/StaticPasswordVerifier.ts';
import { CryptoIdGenerator } from '../infrastructure/services/CryptoIdGenerator.ts';
import { CryptoRandomNumberGenerator } from '../infrastructure/services/CryptoRandomNumberGenerator.ts';
import { SystemClock } from '../infrastructure/services/SystemClock.ts';
import { createApp } from '../presentation/http/app.ts';
import { LiveBroadcaster } from '../presentation/http/live/LiveBroadcaster.ts';
import { consoleLogger } from '../presentation/http/Logger.ts';
import { loadEnv, resolveEmailLogoUrl } from './config/env.ts';
import { makeUseCases } from './makeUseCases.ts';

const SECONDS_PER_HOUR = 3600;
const SHUTDOWN_TIMEOUT_MS = 10_000;

const env = loadEnv();
const database = PrismaContext.connect(env.DATABASE_URL, (error) =>
  consoleLogger.error('Idle database connection error', { message: error.message }),
);
const tokenService = new JwtTokenService(env.JWT_SECRET, Math.round(env.JWT_EXPIRES_IN_HOURS * SECONDS_PER_HOUR));
const clock = new SystemClock();
const liveChannel = new InMemoryLiveDrawChannel(clock, env.DRAW_SUSPENSE_SECONDS * 1000, (error) =>
  consoleLogger.error('Live draw listener failed', { message: (error as Error).message }),
);

const emailSender =
  env.EMAIL_PROVIDER === 'brevo'
    ? new BrevoEmailSender(
        {
          apiKey: env.BREVO_API_KEY as string,
          fromEmail: env.EMAIL_FROM as string,
          fromName: env.EMAIL_FROM_NAME,
          logoUrl: resolveEmailLogoUrl(env),
        },
        (message) => consoleLogger.error(message),
      )
    : new ConsoleEmailSender((message) => consoleLogger.info(message));

const useCases = makeUseCases({
  events: new PrismaEventRepository(database),
  participants: new PrismaParticipantRepository(database),
  prizes: new PrismaPrizeRepository(database),
  prizeImages: new PrismaPrizeImageRepository(database),
  draws: new PrismaDrawRepository(database),
  transaction: new PrismaTransactionManager(database),
  ids: new CryptoIdGenerator(),
  clock,
  random: new CryptoRandomNumberGenerator(),
  passwordVerifier: new StaticPasswordVerifier(env.ADMIN_PASSWORD),
  tokens: tokenService,
  live: liveChannel,
  verifications: new PrismaRegistrationVerificationRepository(database),
  codeHasher: new HmacVerificationCodeHasher(env.JWT_SECRET),
  emailSender,
});

const liveBroadcaster = new LiveBroadcaster(useCases.getLiveBoard, liveChannel, consoleLogger);

const app = createApp({
  useCases,
  tokenService,
  liveBroadcaster,
  isProduction: env.NODE_ENV === 'production',
  corsOrigins: env.CORS_ORIGINS,
  trustProxy: env.TRUST_PROXY,
  clientIpHeader: env.CLIENT_IP_HEADER,
  frontendDistPath: env.FRONTEND_DIST_PATH,
  logger: consoleLogger,
});

const server = app.listen(env.PORT, () => {
  consoleLogger.info(`Server listening on port ${env.PORT}`);
});

function shutdown(signal: string): void {
  consoleLogger.info(`${signal} received, shutting down`);
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
  // Open live streams would otherwise keep the server from closing.
  liveBroadcaster.closeAll();
  server.close(() => {
    void database.disconnect().finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
