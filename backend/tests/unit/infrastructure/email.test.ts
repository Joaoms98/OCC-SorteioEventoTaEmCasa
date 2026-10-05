import { describe, expect, it, vi } from 'vitest';
import { BrevoEmailSender } from '../../../src/infrastructure/email/BrevoEmailSender.ts';
import { ConsoleEmailSender } from '../../../src/infrastructure/email/ConsoleEmailSender.ts';
import { buildVerificationEmail } from '../../../src/infrastructure/email/verificationEmail.ts';
import { HmacVerificationCodeHasher } from '../../../src/infrastructure/security/HmacVerificationCodeHasher.ts';

const message = { to: 'ana@mail.com', name: 'Ana <b>Lima</b>', eventName: 'Tá em Casa', code: '042917', expiresInMinutes: 10 };

describe('verification e-mail', () => {
  it('is written in Portuguese, carries the code and escapes user data', () => {
    const { subject, text, html } = buildVerificationEmail(message);
    expect(subject).toBe('042917 é o seu código de inscrição — Tá em Casa');
    expect(text).toContain('Seu código para confirmar a inscrição no sorteio "Tá em Casa" é: 042917');
    expect(html).toContain('042917');
    expect(html).toContain('Olá, Ana!');
    expect(html).not.toContain('<b>');
  });

  it('shows the logo when it has a public address, and a drawn badge otherwise', () => {
    const withLogo = buildVerificationEmail(message, { logoUrl: 'https://cdn.example.com/occ.png?a=1&b=2' }).html;
    expect(withLogo).toContain('<img src="https://cdn.example.com/occ.png?a=1&amp;b=2"');
    expect(withLogo).toContain('alt="Os Crema Culture"');

    const withoutLogo = buildVerificationEmail(message).html;
    expect(withoutLogo).not.toContain('<img');
    expect(withoutLogo).toContain('>OCC</td>');
    expect(withoutLogo).toContain('Os Crema Culture');
  });

  it('never embeds or loads anything besides the logo', () => {
    const { html } = buildVerificationEmail(message, { logoUrl: 'https://cdn.example.com/occ.png' });
    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html).not.toMatch(/<script|<link|data:image|cid:/);
  });
});

describe('BrevoEmailSender', () => {
  const config = { apiKey: 'xkeysib-123', fromEmail: 'sorteio@occ.com.br', fromName: 'Sorteio OCC' };

  it('calls the Brevo transactional API', async () => {
    const fetchFn = vi.fn(async () => new Response('{"messageId":"1"}', { status: 201 }));
    const delivery = await new BrevoEmailSender(config, undefined, fetchFn as typeof fetch).sendVerificationCode(message);

    expect(delivery).toEqual({});
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.headers).toMatchObject({ 'api-key': 'xkeysib-123' });
    expect(JSON.parse(init.body as string)).toMatchObject({
      sender: { email: 'sorteio@occ.com.br', name: 'Sorteio OCC' },
      to: [{ email: 'ana@mail.com' }],
      subject: expect.stringContaining('042917'),
    });
  });

  it('puts the configured logo in the e-mail', async () => {
    const fetchFn = vi.fn(async () => new Response('{"messageId":"1"}', { status: 201 }));
    const sender = new BrevoEmailSender({ ...config, logoUrl: 'https://occ.example.com/brand/occ-logo-email.png' }, undefined, fetchFn as typeof fetch);
    await sender.sendVerificationCode(message);

    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).htmlContent).toContain('src="https://occ.example.com/brand/occ-logo-email.png"');
  });

  it('fails (and reports why) when Brevo refuses the e-mail', async () => {
    const onError = vi.fn();
    const fetchFn = vi.fn(async () => new Response('{"message":"sender not verified"}', { status: 400 }));
    await expect(
      new BrevoEmailSender(config, onError, fetchFn as typeof fetch).sendVerificationCode(message),
    ).rejects.toThrow('HTTP 400');
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('sender not verified'));
  });
});

describe('development helpers', () => {
  it('ConsoleEmailSender logs and previews the code', async () => {
    const log = vi.fn();
    expect(await new ConsoleEmailSender(log).sendVerificationCode(message)).toEqual({ previewCode: '042917' });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('042917'));
  });

  it('HMAC hasher matches only the right code and depends on the secret', () => {
    const hasher = new HmacVerificationCodeHasher('secret-a');
    const hash = hasher.hash('123456');
    expect(hasher.matches('123456', hash)).toBe(true);
    expect(hasher.matches('123457', hash)).toBe(false);
    expect(new HmacVerificationCodeHasher('secret-b').matches('123456', hash)).toBe(false);
  });
});
