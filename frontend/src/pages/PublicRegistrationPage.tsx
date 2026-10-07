import { ArrowLeft, CircleCheck, Gift, MailCheck, Radio } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError, errorMessage } from '../api/ApiError';
import { publicApi } from '../api/endpoints';
import { assetUrl } from '../api/httpClient';
import { Alert } from '../components/Alert';
import { TextField } from '../components/Field';
import { Spinner } from '../components/Spinner';
import { useAsyncData } from '../hooks/useAsyncData';
import { ParallaxBackground } from '../live/ParallaxBackground';
import { pendingKey, readSpin, registeredKey, saveSpin, storage } from '../registration/registrationStorage';
import { publicPaths } from '../routes';
import type { PublicEvent, PublicPrize, RegistrationResult, RegistrationVerification } from '../types/api';
import { formatDateTime, maskPhone } from '../utils/format';

/** Pending registration kept across reloads (the code may take a moment to arrive). */
interface PendingRegistration extends RegistrationVerification {
  name: string;
}

export function PublicRegistrationPage() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const { data: event, error: loadError, loading } = useAsyncData(() => publicApi.getEvent(eventId), [eventId]);
  const [pending, setPending] = useState<PendingRegistration | null>(() => storage.read(pendingKey(eventId)));
  const [registeredName, setRegisteredName] = useState<string | null>(() => storage.read(registeredKey(eventId)));
  const interactive = event?.drawMode === 'INTERACTIVE';
  // Interactive roulette: the prizes are the pitch, and without any left nobody can register.
  const { data: prizes } = useAsyncData(
    () => (interactive ? publicApi.listPrizes(eventId) : Promise.resolve(null)),
    [eventId, interactive],
  );
  const spin = interactive ? readSpin(eventId) : null;
  const prizesLeft = prizes ? prizes.some((prize) => prize.remainingUnits > 0) : true;

  function startPending(next: PendingRegistration) {
    storage.write('session', pendingKey(eventId), next);
    setPending(next);
  }

  function cancelPending() {
    storage.remove(pendingKey(eventId));
    setPending(null);
  }

  function finish(result: RegistrationResult) {
    storage.remove(pendingKey(eventId));
    storage.write('local', registeredKey(eventId), result.name);
    setPending(null);
    setRegisteredName(result.name);
    // Interactive roulette: straight to the wheel, which stops on the prize already drawn.
    if (result.spin) {
      saveSpin(eventId, { ...result.spin, eventName: event?.name ?? 'Roleta OCC', participantName: result.name, landed: false });
      navigate(publicPaths.spin(eventId));
    }
  }

  function registerAnotherPerson() {
    storage.remove(registeredKey(eventId));
    setRegisteredName(null);
  }

  return (
    <div className="centered-page public-page">
      <ParallaxBackground image="/brand/stage-pattern.webp" />
      <div className="card auth-card">
        <img src="/brand/occ-round.webp" alt="Os Crema Culture" width={112} height={112} className="auth-logo" />
        {loading && !event && <Spinner />}
        {!loading && !event && <Alert>{errorMessage(loadError)}</Alert>}

        {event && (
          <>
            <h1>{event.name}</h1>
            {event.eventDate && <p className="muted">{formatDateTime(event.eventDate)}</p>}
            {event.description && <p className="user-text public-description">{event.description}</p>}

            {interactive && !registeredName && prizes && <PrizePitch prizes={prizes} />}

            {registeredName && spin ? (
              <div className="success-box">
                <CircleCheck className="success-icon" size={48} aria-hidden="true" />
                <h2>Inscrição confirmada!</h2>
                <p>
                  {spin.landed
                    ? `${registeredName.split(' ')[0]}, você já girou a roleta.`
                    : `${registeredName.split(' ')[0]}, a roleta está esperando por você.`}
                </p>
                <Link to={publicPaths.spin(eventId)} className="btn btn-primary btn-block">
                  <Gift size={18} aria-hidden="true" /> {spin.landed ? 'Ver meu brinde' : 'Girar a roleta'}
                </Link>
                <button type="button" className="btn btn-ghost btn-sm" onClick={registerAnotherPerson}>
                  Inscrever outra pessoa
                </button>
              </div>
            ) : registeredName ? (
              <div className="success-box">
                <CircleCheck className="success-icon" size={48} aria-hidden="true" />
                <h2>Inscrição confirmada!</h2>
                <p>Boa sorte, {registeredName.split(' ')[0]}! Fique atento(a) ao sorteio.</p>
                <LiveLink eventId={eventId} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={registerAnotherPerson}>
                  Inscrever outra pessoa
                </button>
              </div>
            ) : interactive && !prizesLeft ? (
              <div className="stack">
                <Alert tone="info">Os brindes deste evento acabaram, então as inscrições foram encerradas.</Alert>
                <LiveLink eventId={eventId} />
              </div>
            ) : !event.registrationOpen ? (
              <div className="stack">
                <Alert tone="info">As inscrições para este sorteio estão encerradas.</Alert>
                <LiveLink eventId={eventId} />
              </div>
            ) : pending ? (
              <CodeStep
                event={event}
                pending={pending}
                onRenewed={startPending}
                onConfirmed={finish}
                onRestart={cancelPending}
              />
            ) : (
              <DataStep eventId={eventId} interactive={interactive} onCodeSent={startPending} />
            )}
          </>
        )}
        <Link to={publicPaths.home} className="back-link public-home-link">
          <ArrowLeft size={16} aria-hidden="true" /> Ver todos os sorteios
        </Link>
      </div>
    </div>
  );
}

/** Interactive roulette: what is on the wheel, before asking for any data. */
function PrizePitch({ prizes }: { prizes: PublicPrize[] }) {
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

function LiveLink({ eventId }: { eventId: string }) {
  return (
    <Link to={publicPaths.live(eventId)} className="btn btn-primary btn-block">
      <Radio size={18} aria-hidden="true" /> Acompanhar o sorteio ao vivo
    </Link>
  );
}

/** Step 1: name, phone and e-mail; the server answers by e-mailing a code. */
function DataStep({
  eventId,
  interactive,
  onCodeSent,
}: {
  eventId: string;
  interactive: boolean;
  onCodeSent(pending: PendingRegistration): void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const fieldErrors = error instanceof ApiError ? error.fieldErrors : {};

  async function handleSubmit(formEvent: FormEvent) {
    formEvent.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const verification = await publicApi.startRegistration(eventId, { name, phone, email });
      onCodeSent({ ...verification, name: name.trim() });
    } catch (caught) {
      setError(caught);
      setSubmitting(false);
    }
  }

  return (
    <form className="stack" noValidate onSubmit={handleSubmit}>
      <h2 className="form-title">{interactive ? 'Inscreva-se para girar a roleta' : 'Participe do sorteio de brindes'}</h2>
      {error ? <Alert>{errorMessage(error)}</Alert> : null}
      <TextField label="Nome completo" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" error={fieldErrors.name} />
      <TextField
        label="Celular (com DDD)"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="(11) 98765-4321"
        value={phone}
        onChange={(e) => setPhone(maskPhone(e.target.value))}
        error={fieldErrors.phone}
      />
      <TextField
        label="E-mail"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
        hint="Vamos enviar um código para confirmar sua inscrição."
      />
      <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={submitting}>
        {submitting ? 'Enviando código…' : 'Receber código por e-mail'}
      </button>
      <p className="muted small">
        Cada pessoa pode se inscrever uma vez. Seus dados serão usados apenas para este sorteio e para contato com os
        ganhadores.
      </p>
    </form>
  );
}

const secondsUntil = (iso: string): number => Math.max(Math.ceil((new Date(iso).getTime() - Date.now()) / 1000), 0);

/** Step 2: the 6-digit code from the e-mail. */
function CodeStep({
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
