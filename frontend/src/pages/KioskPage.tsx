import { CircleCheck, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { errorMessage } from '../api/ApiError';
import { publicApi } from '../api/endpoints';
import { Alert } from '../components/Alert';
import { Spinner } from '../components/Spinner';
import { useAsyncData } from '../hooks/useAsyncData';
import { ParallaxBackground } from '../live/ParallaxBackground';
import { SpinStage } from '../live/SpinStage';
import { CodeStep, DataStep, PrizePitch, type PendingRegistration } from '../registration/RegistrationSteps';
import type { InteractiveSpin, RegistrationResult } from '../types/api';

/** Seconds without a touch before a screen left halfway goes back to the start. */
const IDLE_SECONDS = { form: 120, code: 300, wheel: 120 } as const;
/** How long the result stays on screen when nobody taps "Próxima pessoa". */
const RESULT_SECONDS = 45;

/** Whose turn it is and how far they got. Lives in memory only: the next turn starts from nothing. */
type Turn =
  | { step: 'form' }
  | { step: 'code'; pending: PendingRegistration }
  | { step: 'wheel'; name: string; spin: InteractiveSpin; landed: boolean }
  | { step: 'registered'; name: string };

/**
 * Booth mode: one shared tablet where people register one after another. Unlike the registration
 * page, nothing is kept in the browser storage, so nobody has to clear it between people: form,
 * e-mail code, wheel and prize, then the screen goes back to the form by itself.
 */
export function KioskPage() {
  const { eventId = '' } = useParams();
  const [turn, setTurn] = useState<Turn>({ step: 'form' });
  // Counts the turns: a new one empties the form and fetches the event and its prizes again.
  const [round, setRound] = useState(0);
  const { data: event, error: loadError, loading } = useAsyncData(() => publicApi.getEvent(eventId), [eventId, round]);
  const interactive = event?.drawMode === 'INTERACTIVE';
  const { data: prizes } = useAsyncData(
    () => (interactive ? publicApi.listPrizes(eventId) : Promise.resolve(null)),
    [eventId, interactive, round],
  );
  const prizesLeft = prizes ? prizes.some((prize) => prize.remainingUnits > 0) : true;

  function nextPerson() {
    setTurn({ step: 'form' });
    setRound((current) => current + 1);
    window.scrollTo(0, 0);
  }

  function finish(result: RegistrationResult) {
    setTurn(
      result.spin
        ? { step: 'wheel', name: result.name, spin: result.spin, landed: false }
        : { step: 'registered', name: result.name },
    );
  }

  // The result screens count down on their own; every other screen goes back when left untouched.
  // An untouched form also comes back here, which keeps the prizes and the registration status fresh.
  const showingResult = turn.step === 'registered' || (turn.step === 'wheel' && turn.landed);
  useIdleTimeout(showingResult ? null : IDLE_SECONDS[turn.step], turn.step, nextPerson);
  useScreenAwake();

  if (turn.step === 'wheel') {
    return (
      <SpinStage
        key={turn.spin.drawId}
        eventName={event?.name ?? 'Roleta OCC'}
        participantName={turn.name}
        spin={turn.spin}
        onLanded={() => setTurn((current) => (current.step === 'wheel' ? { ...current, landed: true } : current))}
        pickupNote="Retire o seu brinde aqui no estande."
        resultActions={<NextPerson stage onNext={nextPerson} />}
      />
    );
  }

  return (
    <div className="centered-page public-page">
      <ParallaxBackground image="/brand/stage-pattern.webp" />
      <div className="card auth-card kiosk-card">
        <img src="/brand/occ-round.webp" alt="Os Crema Culture" width={112} height={112} className="auth-logo" />
        {loading && !event && <Spinner />}
        {!loading && !event && (
          <div className="stack">
            <Alert>{errorMessage(loadError)}</Alert>
            <RefreshButton onClick={nextPerson} />
          </div>
        )}

        {event && (
          <>
            <h1>{event.name}</h1>
            {turn.step === 'registered' ? (
              <div className="success-box">
                <CircleCheck className="success-icon" size={48} aria-hidden="true" />
                <h2>Inscrição confirmada!</h2>
                <p>Boa sorte, {turn.name.split(' ')[0]}! Fique atento(a) ao sorteio.</p>
                <NextPerson onNext={nextPerson} />
              </div>
            ) : turn.step === 'code' ? (
              <CodeStep
                sharedDevice
                event={event}
                pending={turn.pending}
                onRenewed={(pending) => setTurn({ step: 'code', pending })}
                onConfirmed={finish}
                onRestart={nextPerson}
              />
            ) : interactive && !prizesLeft ? (
              <div className="stack">
                <Alert tone="info">Os brindes deste evento acabaram, então as inscrições foram encerradas.</Alert>
                <RefreshButton onClick={nextPerson} />
              </div>
            ) : !event.registrationOpen ? (
              <div className="stack">
                <Alert tone="info">As inscrições para este sorteio estão encerradas.</Alert>
                <RefreshButton onClick={nextPerson} />
              </div>
            ) : (
              <>
                {interactive && prizes && <PrizePitch prizes={prizes} />}
                <DataStep
                  key={round}
                  sharedDevice
                  eventId={eventId}
                  interactive={interactive}
                  onCodeSent={(pending) => setTurn({ step: 'code', pending })}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Hands the tablet to whoever comes next: right away on the button, or by itself when the time is up. */
function NextPerson({ stage = false, onNext }: { stage?: boolean; onNext(): void }) {
  const remaining = useCountdown(RESULT_SECONDS, onNext);
  return (
    <div className="kiosk-next">
      <button type="button" className={stage ? 'btn btn-stage' : 'btn btn-primary btn-block btn-lg'} onClick={onNext}>
        Próxima pessoa
      </button>
      <p className={stage ? 'stage-hint' : 'small'}>A tela volta para o início em {remaining}s.</p>
    </div>
  );
}

function RefreshButton({ onClick }: { onClick(): void }) {
  return (
    <button type="button" className="btn btn-secondary btn-block" onClick={onClick}>
      <RefreshCw size={18} aria-hidden="true" /> Atualizar
    </button>
  );
}

/** Seconds left until `onDone`, counted from when the component appears. */
function useCountdown(seconds: number, onDone: () => void): number {
  const [remaining, setRemaining] = useState(seconds);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const endsAt = Date.now() + seconds * 1000;
    const timer = setInterval(() => {
      const left = Math.max(Math.ceil((endsAt - Date.now()) / 1000), 0);
      setRemaining(left);
      if (left === 0) {
        clearInterval(timer);
        onDoneRef.current();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [seconds]);

  return remaining;
}

/**
 * Calls `onIdle` every `seconds` in which nobody touches the screen or types (null turns it off).
 * The count starts again whenever `phase` changes.
 */
function useIdleTimeout(seconds: number | null, phase: string, onIdle: () => void): void {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (seconds === null) return;
    let timer = 0;
    const restart = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        onIdleRef.current();
        restart();
      }, seconds * 1000);
    };
    const activity = ['pointerdown', 'keydown', 'input'] as const;
    activity.forEach((type) => window.addEventListener(type, restart, true));
    restart();
    return () => {
      window.clearTimeout(timer);
      activity.forEach((type) => window.removeEventListener(type, restart, true));
    };
  }, [seconds, phase]);
}

/** Keeps the tablet's screen on while the booth page is open, where the browser allows it. */
function useScreenAwake(): void {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let closed = false;
    // The browser drops the lock when the page is hidden: ask again every time it comes back.
    const request = async () => {
      if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
      try {
        const acquired = await navigator.wakeLock.request('screen');
        if (closed) void acquired.release();
        else lock = acquired;
      } catch {
        // Refused (battery saver, page not on https): the tablet's own screen timeout applies.
      }
    };
    void request();
    document.addEventListener('visibilitychange', request);
    return () => {
      closed = true;
      document.removeEventListener('visibilitychange', request);
      void lock?.release();
    };
  }, []);
}
