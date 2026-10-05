import type { EmailDelivery, EmailSender, VerificationCodeEmail } from '../../application/ports/EmailSender.ts';

/**
 * Development sender: no e-mail leaves the machine; the code is logged and returned so the
 * registration page can show it. Refused in production by the environment validation.
 */
export class ConsoleEmailSender implements EmailSender {
  constructor(private readonly log: (message: string) => void = console.info) {}

  async sendVerificationCode(email: VerificationCodeEmail): Promise<EmailDelivery> {
    this.log(`[dev e-mail] verification code for "${email.eventName}": ${email.code}`);
    return { previewCode: email.code };
  }
}
