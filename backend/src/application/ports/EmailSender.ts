export interface VerificationCodeEmail {
  to: string;
  name: string;
  eventName: string;
  code: string;
  expiresInMinutes: number;
}

export interface EmailDelivery {
  /**
   * Development-only senders (no real e-mail) return the code so it can be shown on screen.
   * Real providers never return it.
   */
  previewCode?: string;
}

export interface EmailSender {
  sendVerificationCode(email: VerificationCodeEmail): Promise<EmailDelivery>;
}
