import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

if (existsSync('.env')) process.loadEnvFile('.env');

const DEFAULT_FRONTEND_DIST = fileURLToPath(new URL('../../../../frontend/dist', import.meta.url));

// Values shipped in .env.example must never reach production.
const EXAMPLE_SECRETS = new Set([
  'change-me-to-a-long-random-string-with-32-plus-chars',
  'troque-esta-senha',
]);

const envSchema = z
  .object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must have at least 32 characters'),
  JWT_EXPIRES_IN_HOURS: z.coerce.number().positive().default(12),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD must have at least 8 characters'),
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',').map((origin) => origin.trim()).filter(Boolean) : [])),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  /** Header in which the hosting edge sends the visitor's real address (Render: cf-connecting-ip). */
  CLIENT_IP_HEADER: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'CLIENT_IP_HEADER must be a header name')
    .optional(),
  /** Suspense shown to everyone (projector and live viewers) before the winner is revealed. */
  DRAW_SUSPENSE_SECONDS: z.coerce.number().min(0).max(30).default(6),
  /** "console" (development: codes shown on screen) or "brevo" (real e-mails, required in production). */
  EMAIL_PROVIDER: z.enum(['console', 'brevo']).default('console'),
  BREVO_API_KEY: z.string().optional(),
  EMAIL_FROM: z.email('EMAIL_FROM must be an e-mail address').optional(),
  EMAIL_FROM_NAME: z.string().min(1).default('Sorteio OCC'),
  /** Public address of the logo shown in the e-mails; defaults to the copy served by this app. */
  EMAIL_LOGO_URL: z.url('EMAIL_LOGO_URL must be an absolute URL').optional(),
  /** Public address of the app (e.g. https://sorteio.exemplo.com). */
  PUBLIC_URL: z.url('PUBLIC_URL must be an absolute URL').optional(),
  /** Set by Render on its own: used as PUBLIC_URL when that one is not given. */
  RENDER_EXTERNAL_URL: z.url().optional(),
  FRONTEND_DIST_PATH: z.string().optional().default(DEFAULT_FRONTEND_DIST),
  })
  .superRefine((env, ctx) => {
    if (env.EMAIL_PROVIDER === 'brevo') {
      if (!env.BREVO_API_KEY) ctx.addIssue({ code: 'custom', path: ['BREVO_API_KEY'], message: 'BREVO_API_KEY is required when EMAIL_PROVIDER=brevo' });
      if (!env.EMAIL_FROM) ctx.addIssue({ code: 'custom', path: ['EMAIL_FROM'], message: 'EMAIL_FROM is required when EMAIL_PROVIDER=brevo' });
    }
    if (env.NODE_ENV !== 'production') {
      // On Render without the blueprint: development mode would show the codes on screen and accept weak secrets.
      if (env.RENDER_EXTERNAL_URL) {
        ctx.addIssue({ code: 'custom', path: ['NODE_ENV'], message: 'NODE_ENV must be "production" on Render' });
      }
      return;
    }
    if (env.EMAIL_PROVIDER === 'console') {
      ctx.addIssue({
        code: 'custom',
        path: ['EMAIL_PROVIDER'],
        message: 'EMAIL_PROVIDER must be "brevo" in production: verification codes must reach participants by e-mail',
      });
    }
    for (const key of ['JWT_SECRET', 'ADMIN_PASSWORD'] as const) {
      if (EXAMPLE_SECRETS.has(env[key])) {
        ctx.addIssue({ code: 'custom', path: [key], message: `${key} still has the example value from .env.example` });
      }
    }
    if (env.ADMIN_PASSWORD.length < 12) {
      ctx.addIssue({ code: 'custom', path: ['ADMIN_PASSWORD'], message: 'ADMIN_PASSWORD must have at least 12 characters in production' });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Path of the e-mail logo inside the frontend build (frontend/public/brand). */
const EMAIL_LOGO_PATH = '/brand/occ-logo-email.png';

/**
 * E-mail apps only show images hosted at a public address. Returns null while the app has none
 * (local development): the e-mail then uses a drawn badge instead of the logo.
 */
export function resolveEmailLogoUrl(env: Pick<Env, 'EMAIL_LOGO_URL' | 'PUBLIC_URL' | 'RENDER_EXTERNAL_URL'>): string | null {
  if (env.EMAIL_LOGO_URL) return env.EMAIL_LOGO_URL;
  const publicUrl = env.PUBLIC_URL ?? env.RENDER_EXTERNAL_URL;
  return publicUrl ? new URL(EMAIL_LOGO_PATH, publicUrl).href : null;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}
