import type { VerificationCodeEmail } from '../../application/ports/EmailSender.ts';

export interface EmailBranding {
  /**
   * Public address of the OCC logo. E-mail apps cannot show images embedded in the message
   * (and Brevo does not send inline images), so without it a drawn "OCC" badge is used.
   */
  logoUrl?: string | null;
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

const SERIF = "Georgia,'Times New Roman',serif";
const SANS = 'Arial,Helvetica,sans-serif';

/** The round OCC logo; the alt text is styled so it still reads well when images are blocked. */
const logoImage = (logoUrl: string): string =>
  `<img src="${escapeHtml(logoUrl)}" width="112" height="112" alt="Os Crema Culture" style="display:block;width:112px;height:112px;margin:0 auto;border:0;outline:none;font-family:${SERIF};font-size:18px;font-weight:bold;color:#fbf8cc">`;

/** Drawn with tables and borders only, so it shows in every e-mail app without loading anything. */
const logoBadge = `<table role="presentation" align="center" cellspacing="0" cellpadding="0" style="margin:0 auto">
              <tr><td align="center" valign="middle" width="96" height="96" style="width:96px;height:96px;background:#e8611f;border:4px solid #fbf8cc;border-radius:50%;font-family:${SERIF};font-size:30px;font-weight:bold;letter-spacing:1px;color:#fbf8cc">OCC</td></tr>
            </table>
            <p style="margin:12px 0 0;font-family:${SERIF};font-size:22px;font-weight:bold;color:#fbf8cc">Os Crema Culture</p>`;

/** Verification e-mail (pt-BR) in the OCC identity: logo, code in evidence; plain-text version included. */
export function buildVerificationEmail(email: VerificationCodeEmail, branding: EmailBranding = {}) {
  const firstName = email.name.split(' ')[0] ?? email.name;
  const subject = `${email.code} é o seu código de inscrição — ${email.eventName}`;
  const text = [
    `Olá, ${firstName}!`,
    '',
    `Seu código para confirmar a inscrição no sorteio "${email.eventName}" é: ${email.code}`,
    '',
    `O código vale por ${email.expiresInMinutes} minutos. Se você não pediu esta inscrição, ignore este e-mail.`,
    '',
    'Os Crema Culture — conectando pessoas, cultura e liberdade',
  ].join('\n');

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#fdfaeb">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#fdfaeb">Seu código vale por ${email.expiresInMinutes} minutos.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fdfaeb">
      <tr><td align="center" style="padding:28px 12px">
        <table role="presentation" width="480" cellspacing="0" cellpadding="0" style="width:100%;max-width:480px;background:#fffef8;border:2px solid #2e2419;border-bottom:6px solid #2e2419;border-radius:18px">
          <tr><td align="center" style="padding:26px 24px 20px;background:#2e2419;border-radius:14px 14px 0 0">
            ${branding.logoUrl ? logoImage(branding.logoUrl) : logoBadge}
            <p style="margin:12px 0 0;font-family:${SANS};font-size:12px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:#f2843f">Sorteio de brindes</p>
          </td></tr>
          <tr><td style="height:6px;font-size:0;line-height:0;background:#e8611f">&nbsp;</td></tr>
          <tr><td style="padding:28px 28px 10px;font-family:${SANS};color:#2e2419">
            <h1 style="margin:0 0 12px;font-family:${SERIF};font-size:26px;line-height:1.2;color:#2e2419">Olá, ${escapeHtml(firstName)}!</h1>
            <p style="margin:0 0 20px;font-size:16px;line-height:1.5">Use o código abaixo para confirmar sua inscrição no sorteio <strong>${escapeHtml(email.eventName)}</strong>:</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr><td align="center" style="padding:18px 8px 18px 18px;background:#fbf8cc;border:2px dashed #e8611f;border-radius:14px;font-family:${SANS};font-size:38px;font-weight:bold;letter-spacing:10px;color:#2e2419">${escapeHtml(email.code)}</td></tr>
            </table>
            <p style="margin:20px 0 18px;font-size:13px;line-height:1.5;color:#75644c">O código vale por ${email.expiresInMinutes} minutos. Se você não pediu esta inscrição, ignore este e-mail.</p>
          </td></tr>
          <tr><td align="center" style="padding:14px 24px;background:#e8611f;border-radius:0 0 10px 10px;font-family:${SANS};font-size:12px;font-weight:bold;color:#2e2419">Os Crema Culture · conectando pessoas, cultura e liberdade</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
