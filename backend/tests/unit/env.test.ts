import { describe, expect, it } from 'vitest';
import { loadEnv, resolveEmailLogoUrl } from '../../src/main/config/env.ts';

const valid = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'a-really-long-and-random-secret-value-1234567890',
  ADMIN_PASSWORD: 'uma-senha-bem-forte',
};

/** What the Render blueprint sets besides the secrets. */
const onRender = { ...valid, NODE_ENV: 'production', EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'xkeysib-teste', EMAIL_FROM: 'sorteio@occ.com.br' };

describe('resolveEmailLogoUrl', () => {
  it('has no logo address while the app is not public (local development)', () => {
    expect(resolveEmailLogoUrl(loadEnv(valid))).toBeNull();
  });

  it('uses the copy served by the app at its public address (PUBLIC_URL, or the one Render sets)', () => {
    expect(resolveEmailLogoUrl(loadEnv({ ...onRender, RENDER_EXTERNAL_URL: 'https://occ-sorteio.onrender.com' }))).toBe(
      'https://occ-sorteio.onrender.com/brand/occ-logo-email.png',
    );
    expect(
      resolveEmailLogoUrl(
        loadEnv({ ...onRender, PUBLIC_URL: 'https://sorteio.occ.com.br/', RENDER_EXTERNAL_URL: 'https://occ-sorteio.onrender.com' }),
      ),
    ).toBe('https://sorteio.occ.com.br/brand/occ-logo-email.png');
  });

  it('an explicit EMAIL_LOGO_URL wins, and must be an absolute URL', () => {
    const env = loadEnv({ ...valid, PUBLIC_URL: 'https://sorteio.occ.com.br', EMAIL_LOGO_URL: 'https://cdn.example.com/occ.png' });
    expect(resolveEmailLogoUrl(env)).toBe('https://cdn.example.com/occ.png');
    expect(() => loadEnv({ ...valid, EMAIL_LOGO_URL: 'occ.png' })).toThrow(/EMAIL_LOGO_URL/);
  });
});

describe('loadEnv', () => {
  it('applies defaults and parses CORS origins', () => {
    const env = loadEnv({ ...valid, CORS_ORIGINS: 'https://a.com, https://b.com' });
    expect(env).toMatchObject({ NODE_ENV: 'development', PORT: 3333, TRUST_PROXY: 0, JWT_EXPIRES_IN_HOURS: 12 });
    expect(env.CORS_ORIGINS).toEqual(['https://a.com', 'https://b.com']);
  });

  it('accepts the edge header that carries the visitor address, as a header name', () => {
    expect(loadEnv({ ...valid, CLIENT_IP_HEADER: 'CF-Connecting-IP' }).CLIENT_IP_HEADER).toBe('cf-connecting-ip');
    expect(loadEnv(valid).CLIENT_IP_HEADER).toBeUndefined();
    expect(() => loadEnv({ ...valid, CLIENT_IP_HEADER: 'x forwarded: for' })).toThrow(/CLIENT_IP_HEADER/);
  });

  it('rejects missing or weak settings', () => {
    expect(() => loadEnv({ ...valid, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
    expect(() => loadEnv({ ...valid, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ ...valid, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('requires real e-mail delivery in production', () => {
    expect(() => loadEnv({ ...valid, NODE_ENV: 'production' })).toThrow(/EMAIL_PROVIDER must be "brevo"/);
    expect(() => loadEnv({ ...valid, EMAIL_PROVIDER: 'brevo' })).toThrow(/BREVO_API_KEY[\s\S]*EMAIL_FROM/);
    expect(loadEnv(valid).EMAIL_PROVIDER).toBe('console');
  });

  it('refuses to run in development mode on Render (codes would be shown on screen)', () => {
    expect(() => loadEnv({ ...valid, RENDER_EXTERNAL_URL: 'https://occ-sorteio.onrender.com' })).toThrow(
      /NODE_ENV must be "production" on Render/,
    );
  });

  it('refuses the .env.example secrets and short admin passwords in production', () => {
    const production = {
      ...valid,
      NODE_ENV: 'production',
      EMAIL_PROVIDER: 'brevo',
      BREVO_API_KEY: 'xkeysib-test',
      EMAIL_FROM: 'sorteio@occ.com.br',
    };
    expect(() => loadEnv({ ...production, ADMIN_PASSWORD: 'troque-esta-senha' })).toThrow(/ADMIN_PASSWORD/);
    expect(() =>
      loadEnv({ ...production, JWT_SECRET: 'change-me-to-a-long-random-string-with-32-plus-chars' }),
    ).toThrow(/JWT_SECRET/);
    expect(() => loadEnv({ ...production, ADMIN_PASSWORD: 'curta1234' })).toThrow(/12 characters/);
    expect(loadEnv(production).NODE_ENV).toBe('production');
  });
});
