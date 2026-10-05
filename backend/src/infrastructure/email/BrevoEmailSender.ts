import type { EmailDelivery, EmailSender, VerificationCodeEmail } from '../../application/ports/EmailSender.ts';
import { buildVerificationEmail } from './verificationEmail.ts';

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 10_000;

export interface BrevoConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  /** Public address of the logo shown in the e-mail (a drawn badge is used without it). */
  logoUrl?: string | null;
}

/**
 * Brevo transactional e-mail over HTTPS (free plan: 300 e-mails/day). HTTP instead of SMTP
 * because free hosts often block outgoing SMTP ports.
 */
export class BrevoEmailSender implements EmailSender {
  constructor(
    private readonly config: BrevoConfig,
    private readonly onError: (message: string) => void = () => {},
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async sendVerificationCode(email: VerificationCodeEmail): Promise<EmailDelivery> {
    const { subject, text, html } = buildVerificationEmail(email, { logoUrl: this.config.logoUrl });
    const response = await this.fetchFn(BREVO_ENDPOINT, {
      method: 'POST',
      headers: { 'api-key': this.config.apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: this.config.fromEmail, name: this.config.fromName },
        to: [{ email: email.to, name: email.name }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      this.onError(`Brevo rejected the e-mail (HTTP ${response.status}): ${detail}`);
      throw new Error(`Brevo responded with HTTP ${response.status}`);
    }
    return {};
  }
}
