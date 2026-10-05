import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { TokenService } from '../../application/ports/TokenService.ts';
import type { LiveBroadcaster } from './live/LiveBroadcaster.ts';
import { consoleLogger, type Logger } from './Logger.ts';
import { errorHandler } from './middlewares/errorHandler.ts';
import { notFoundHandler } from './middlewares/notFoundHandler.ts';
import { createApiRouter, type HttpUseCases } from './routes/createApiRouter.ts';

export interface AppOptions {
  useCases: HttpUseCases;
  tokenService: TokenService;
  liveBroadcaster: LiveBroadcaster;
  isProduction: boolean;
  corsOrigins?: string[];
  /** Number of reverse proxies in front of the app (Render uses 1); needed for per-IP rate limits. */
  trustProxy?: number;
  /** Header with the visitor's real address, set by the hosting edge (see RateLimitOptions). */
  clientIpHeader?: string;
  /** Built React app to serve from the same origin; skipped when the folder does not exist. */
  frontendDistPath?: string | null;
  logger?: Logger;
}

export function createApp(options: AppOptions): Express {
  const logger = options.logger ?? consoleLogger;
  const app = express();

  app.disable('x-powered-by');
  if (options.trustProxy) app.set('trust proxy', options.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // blob: lets the prize form preview a photo before uploading it.
          imgSrc: ["'self'", 'data:', 'blob:'],
          upgradeInsecureRequests: options.isProduction ? [] : null,
        },
      },
    }),
  );
  if (options.corsOrigins?.length) {
    app.use('/api', cors({ origin: options.corsOrigins }));
  }
  app.use(express.json({ limit: '1mb' }));

  app.use(
    '/api',
    createApiRouter(options.useCases, options.tokenService, options.liveBroadcaster, { clientIpHeader: options.clientIpHeader }),
  );
  app.use('/api', notFoundHandler);

  if (options.frontendDistPath && existsSync(join(options.frontendDistPath, 'index.html'))) {
    serveFrontend(app, options.frontendDistPath);
  }

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}

function serveFrontend(app: Express, distPath: string): void {
  const indexFile = join(distPath, 'index.html');

  app.use(
    express.static(distPath, {
      index: false,
      setHeaders: (res, filePath) => {
        // Vite fingerprints everything under /assets, so it can be cached forever.
        const isFingerprinted = filePath.includes(`${join(distPath, 'assets')}`);
        res.setHeader('Cache-Control', isFingerprinted ? 'public, max-age=31536000, immutable' : 'no-cache');
        // Brand images are loaded by e-mail apps (the logo of the verification e-mail), i.e. from another origin.
        if (filePath.startsWith(join(distPath, 'brand'))) res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    }),
  );

  // Client-side routing: other GETs get the SPA shell, except missing files (e.g. old chunks after a deploy).
  app.use((req, res, next) => {
    if (req.method !== 'GET' || extname(req.path) !== '' || !req.accepts('html')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexFile);
  });
}
