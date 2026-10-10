import { ArrowLeft, CircleCheck, Gift, Radio } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { errorMessage } from '../api/ApiError';
import { publicApi } from '../api/endpoints';
import { Alert } from '../components/Alert';
import { Spinner } from '../components/Spinner';
import { useAsyncData } from '../hooks/useAsyncData';
import { ParallaxBackground } from '../live/ParallaxBackground';
import { CodeStep, DataStep, PrizePitch, type PendingRegistration } from '../registration/RegistrationSteps';
import { pendingKey, readSpin, registeredKey, saveSpin, storage } from '../registration/registrationStorage';
import { publicPaths } from '../routes';
import type { RegistrationResult } from '../types/api';
import { formatDateTime } from '../utils/format';

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

function LiveLink({ eventId }: { eventId: string }) {
  return (
    <Link to={publicPaths.live(eventId)} className="btn btn-primary btn-block">
      <Radio size={18} aria-hidden="true" /> Acompanhar o sorteio ao vivo
    </Link>
  );
}
