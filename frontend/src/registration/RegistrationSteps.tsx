import { Gift, MailCheck } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ApiError, errorMessage } from '../api/ApiError';
import { publicApi } from '../api/endpoints';
import { assetUrl } from '../api/httpClient';
import { Alert } from '../components/Alert';
import { TextField } from '../components/Field';
import { ParallaxBackground } from '../live/ParallaxBackground';
import type { ParticipantInput, PublicEvent, PublicPrize, RegistrationResult, RegistrationVerification } from '../types/api';
import { formatDateTime, maskPhone } from '../utils/format';

/** Registration waiting for the code sent by e-mail. */
export interface PendingRegistration extends RegistrationVerification {
  name: string;
}

/** The card every registration screen sits on, over the moving brand pattern. */
export function RegistrationCard({ wide = false, children }: { wide?: boolean; children: ReactNode }) {
  return (
    <div className="centered-page public-page">
      <ParallaxBackground image="/brand/stage-pattern.webp" />
      <div className={wide ? 'card auth-card auth-card-wide' : 'card auth-card'}>
        <img src="/brand/occ-round.webp" alt="Os Crema Culture" width={112} height={112} className="auth-logo" />
        {children}
      </div>
    </div>
  );
}

export function EventIntro({ event }: { event: PublicEvent }) {
  return (
    <>
      <h1>{event.name}</h1>
      {event.eventDate && <p className="muted">{formatDateTime(event.eventDate)}</p>}
      {event.description && <p className="user-text public-description">{event.description}</p>}
    </>
  );
}

/** Interactive roulette: what is on the wheel, before asking for any data. */
export function PrizePitch({ prizes }: { prizes: PublicPrize[] }) {
  const available = prizes.filter((prize) => prize.remainingUnits > 0);
  if (available.length === 0) return null;
  return (
    <div className="prize-pitch">
      <p>
        <strong>Inscreva-se e gire a roleta:</strong> todo mundo ganha um brinde.
      </p>
      <ul className="public-prizes" aria-label="Brindes na roleta">
        {available.map((prize) => (
          <li key={prize.id}>
            {prize.imageUrl ? <img src={assetUrl(prize.imageUrl)} alt="" /> : <Gift size={16} aria-hidden="true" />}
            {prize.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export type RegistrationData = Required<ParticipantInput>;

/** The registration form: name, phone and e-mail. What happens next is up to `onSubmit`. */
export function DataStep({
  title,
  submitLabel,
  submittingLabel,
  emailHint,
  sharedDevice = false,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  submittingLabel: string;
  emailHint?: string;
  /** Screen used by one person after another (booth tablet): the browser must not offer what earlier people typed. */
  sharedDevice?: boolean;
  /** Sends the data; a refusal is shown on the form and on its fields. */
  onSubmit(data: RegistrationData): Promise<void>;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const fieldErrors = error instanceof ApiError ? error.fieldErrors : {};
  const autoComplete = (token: string) => (sharedDevice ? 'off' : token);

  async function handleSubmit(formEvent: FormEvent) {
    formEvent.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name, phone, email });
    } catch (caught) {
      setError(caught);
      setSubmitting(false);
    }
  }

  return (
    <form className="stack" noValidate autoComplete={sharedDevice ? 'off' : undefined} onSubmit={handleSubmit}>
      <h2 className="form-title">{title}</h2>
      {error ? <Alert>{errorMessage(error)}</Alert> : null}
      <TextField
        label="Nome completo"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={120}
        autoComplete={autoComplete('name')}
        error={fieldErrors.name}
      />
      <TextField
        label="Celular (com DDD)"
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete('tel-national')}
        placeholder="(11) 98765-4321"
        value={phone}
        onChange={(e) => setPhone(maskPhone(e.target.value))}
        error={fieldErrors.phone}
      />
      <TextField
        label="E-mail"
        type="email"
        inputMode="email"
        autoComplete={autoComplete('email')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
        hint={emailHint}
      />
      <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={submitting}>
        {submitting ? submittingLabel : submitLabel}
      </button>
      <p className="muted small">
        Cada pessoa pode se inscrever uma vez. Seus dados serão usados apenas para este sorteio e para contato com os
        ganhadores.
      </p>
    </form>
  );
}

const secondsUntil = (iso: string): number => Math.max(Math.ceil((new Date(iso).getTime() - Date.now()) / 1000), 0);

/** Raffles drawn by the organizer, after the form: the 6-digit code from the e-mail. */
export function CodeStep({
  event,
  pending,
  onRenewed,
  onConfirmed,
  onRestart,
}: {
  event: PublicEvent;
  pending: PendingRegistration;
  onRenewed(pending: PendingRegistration): void;
  onConfirmed(result: RegistrationResult): void;
  onRestart(): void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [, setTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resendIn = secondsUntil(pending.resendAvailableAt);

  // Re-render every second for the resend countdown.
  useEffect(() => {
    const timer = setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => inputRef.current?.focus(), []);

  async function confirm(value: string) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      onConfirmed(await publicApi.confirmRegistration(event.id, pending.verificationId, value));
    } catch (caught) {
      // Nothing left to confirm (already used or removed): start again from the form.
      if (caught instanceof ApiError && caught.code === 'VERIFICATION_NOT_FOUND') {
        onRestart();
        return;
      }
      setError(caught);
      setCode('');
      setSubmitting(false);
      inputRef.current?.focus();
    }
  }

  function handleChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) void confirm(digits);
  }

  async function resend() {
    setResending(true);
    setError(null);
    try {
      const renewed = await publicApi.resendRegistrationCode(event.id, pending.verificationId);
      onRenewed({ ...renewed, name: pending.name });
      setNotice(`Enviamos um novo código para ${renewed.email}.`);
      setCode('');
    } catch (caught) {
      setError(caught);
    } finally {
      setResending(false);
    }
  }

  function handleSubmit(formEvent: FormEvent) {
    formEvent.preventDefault();
    void confirm(code);
  }

  return (
    <form className="stack" noValidate onSubmit={handleSubmit}>
      <div className="code-step-header">
        <MailCheck size={40} aria-hidden="true" />
        <h2 className="form-title">Confira seu e-mail</h2>
        <p className="muted">
          Enviamos um código de 6 números para <strong>{pending.email}</strong>. Ele vale por 10 minutos.
        </p>
      </div>

      {pending.previewCode && (
        <Alert tone="info">
          Ambiente de teste: nenhum e-mail é enviado. O código é <strong>{pending.previewCode}</strong>.
        </Alert>
      )}
      {notice && <Alert tone="success">{notice}</Alert>}
      {error ? <Alert>{errorMessage(error)}</Alert> : null}

      <div className="field">
        <label htmlFor="verification-code">Código de confirmação</label>
        <input
          ref={inputRef}
          id="verification-code"
          className="code-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => handleChange(e.target.value)}
          disabled={submitting}
          aria-describedby="code-help"
        />
        <small id="code-help" className="field-hint">
          Não chegou? Veja também a caixa de spam ou promoções.
        </small>
      </div>

      <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={submitting || code.length !== 6}>
        {submitting ? 'Confirmando…' : 'Confirmar inscrição'}
      </button>

      <div className="code-step-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={resend} disabled={resending || resendIn > 0}>
          {resending ? 'Reenviando…' : resendIn > 0 ? `Reenviar código em ${resendIn}s` : 'Reenviar código'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRestart}>
          Corrigir meus dados
        </button>
      </div>
    </form>
  );
}
