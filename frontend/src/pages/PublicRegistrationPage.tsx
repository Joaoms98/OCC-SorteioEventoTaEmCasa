import { ArrowLeft, CircleCheck, Radio } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { errorMessage } from '../api/ApiError';
import { publicApi } from '../api/endpoints';
import { Alert } from '../components/Alert';
import { Spinner } from '../components/Spinner';
import { useAsyncData } from '../hooks/useAsyncData';
import { InteractiveRegistration } from '../registration/InteractiveRegistration';
import { CodeStep, DataStep, EventIntro, RegistrationCard, type PendingRegistration } from '../registration/RegistrationSteps';
import { pendingKey, registeredKey, storage } from '../registration/registrationStorage';
import { publicPaths } from '../routes';
import type { PublicEvent, RegistrationResult } from '../types/api';

export function PublicRegistrationPage() {
  const { eventId = '' } = useParams();
  const { data: event, error: loadError, loading, reload } = useAsyncData(() => publicApi.getEvent(eventId), [eventId]);

  if (!event) {
    return (
      <RegistrationCard>
        {loading ? <Spinner /> : <Alert>{errorMessage(loadError)}</Alert>}
        <HomeLink />
      </RegistrationCard>
    );
  }
  // Interactive roulette: registering and spinning are one flow, on a screen people share.
  return event.drawMode === 'INTERACTIVE' ? (
    <InteractiveRegistration key={event.id} event={event} onRefresh={reload} />
  ) : (
    <RaffleRegistration key={event.id} event={event} />
  );
}

/** Raffle drawn by the organizer: each phone remembers its registration, so the form is not offered again. */
function RaffleRegistration({ event }: { event: PublicEvent }) {
  const eventId = event.id;
  // The pending code survives a reload (it may take a moment to arrive).
  const [pending, setPending] = useState<PendingRegistration | null>(() => storage.read(pendingKey(eventId)));
  const [registeredName, setRegisteredName] = useState<string | null>(() => storage.read(registeredKey(eventId)));

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
  }

  function registerAnotherPerson() {
    storage.remove(registeredKey(eventId));
    setRegisteredName(null);
  }

  return (
    <RegistrationCard>
      <EventIntro event={event} />
      {registeredName ? (
        <div className="success-box">
          <CircleCheck className="success-icon" size={48} aria-hidden="true" />
          <h2>Inscrição confirmada!</h2>
          <p>Boa sorte, {registeredName.split(' ')[0]}! Fique atento(a) ao sorteio.</p>
          <LiveLink eventId={eventId} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={registerAnotherPerson}>
            Inscrever outra pessoa
          </button>
        </div>
      ) : !event.registrationOpen ? (
        <div className="stack">
          <Alert tone="info">As inscrições para este sorteio estão encerradas.</Alert>
          <LiveLink eventId={eventId} />
        </div>
      ) : pending ? (
        <CodeStep event={event} pending={pending} onRenewed={startPending} onConfirmed={finish} onRestart={cancelPending} />
      ) : (
        <DataStep
          title="Participe do sorteio de brindes"
          submitLabel="Receber código por e-mail"
          submittingLabel="Enviando código…"
          emailHint="Vamos enviar um código para confirmar sua inscrição."
          onSubmit={async (data) => startPending({ ...(await publicApi.startRegistration(eventId, data)), name: data.name.trim() })}
        />
      )}
      <HomeLink />
    </RegistrationCard>
  );
}

function LiveLink({ eventId }: { eventId: string }) {
  return (
    <Link to={publicPaths.live(eventId)} className="btn btn-primary btn-block">
      <Radio size={18} aria-hidden="true" /> Acompanhar o sorteio ao vivo
    </Link>
  );
}

function HomeLink() {
  return (
    <Link to={publicPaths.home} className="back-link public-home-link">
      <ArrowLeft size={16} aria-hidden="true" /> Ver todos os sorteios
    </Link>
  );
}
