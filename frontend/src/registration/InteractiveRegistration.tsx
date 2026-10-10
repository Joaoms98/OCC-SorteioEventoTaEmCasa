import { RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { publicApi } from '../api/endpoints';
import { Alert } from '../components/Alert';
import { useAsyncData } from '../hooks/useAsyncData';
import { SpinStage } from '../live/SpinStage';
import type { InteractiveSpin, PublicEvent, SpinResult } from '../types/api';
import { DataStep, EventIntro, PrizePitch, RegistrationCard } from './RegistrationSteps';

/** Seconds without a touch before a form or a wheel left halfway goes back to the start. */
const IDLE_SECONDS = 120;
/** How long the prize stays on screen when nobody taps "Próxima pessoa". */
const RESULT_SECONDS = 45;

/** Whose turn it is and how far they got. Lives in memory only: the next turn starts from nothing. */
type Turn = { step: 'form' } | { step: 'wheel'; name: string; spin: InteractiveSpin; landed: boolean };

interface InteractiveRegistrationProps {
  event: PublicEvent;
  /** Fetches the event again without leaving the screen. */
  onRefresh(): void;
}

/**
 * Interactive roulette: fill in the form, spin the wheel, see the prize (no e-mail code). The same
 * screen serves one person after another (a booth tablet as well as each one's phone): nothing is
 * kept in the browser, and after the prize the screen goes back to an empty form by itself.
 */
export function InteractiveRegistration({ event, onRefresh }: InteractiveRegistrationProps) {
  const eventId = event.id;
  const [turn, setTurn] = useState<Turn>({ step: 'form' });
  // Counts the turns: a new one empties the form and fetches the event and its prizes again.
  const [round, setRound] = useState(0);
  const { data: prizes } = useAsyncData(() => publicApi.listPrizes(eventId), [eventId, round]);
  const prizesLeft = prizes ? prizes.some((prize) => prize.remainingUnits > 0) : true;

  function nextPerson() {
    setTurn({ step: 'form' });
    setRound((current) => current + 1);
    onRefresh();
    window.scrollTo(0, 0);
  }

  // The server registers and draws the prize at once; the wheel only has to land on it.
  function showWheel({ name, spin }: SpinResult) {
    setTurn({ step: 'wheel', name, spin, landed: false });
  }

  // The prize counts down on its own; the form and the unspun wheel go back when left untouched.
  const showingPrize = turn.step === 'wheel' && turn.landed;
  useIdleTimeout(showingPrize ? null : IDLE_SECONDS, turn.step, nextPerson);
  useScreenAwake();

  if (turn.step === 'wheel') {
    return (
      <SpinStage
        key={turn.spin.drawId}
        eventName={event.name}
        participantName={turn.name}
        spin={turn.spin}
        onLanded={() => setTurn((current) => (current.step === 'wheel' ? { ...current, landed: true } : current))}
        pickupNote="Retire o seu brinde com a organização."
        resultActions={<NextPerson onNext={nextPerson} />}
      />
    );
  }

  return (
    <RegistrationCard wide>
      <EventIntro event={event} />
      {!prizesLeft ? (
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
          {prizes && <PrizePitch prizes={prizes} />}
          <DataStep
            key={round}
            sharedDevice
            title="Inscreva-se para girar a roleta"
            submitLabel="Ir para a roleta"
            submittingLabel="Preparando a roleta…"
            onSubmit={async (data) => showWheel(await publicApi.registerAndSpin(eventId, data))}
          />
        </>
      )}
    </RegistrationCard>
  );
}

/** Hands the screen to whoever comes next: right away on the button, or by itself when the time is up. */
function NextPerson({ onNext }: { onNext(): void }) {
  const remaining = useCountdown(RESULT_SECONDS, onNext);
  return (
    <div className="next-person">
      <button type="button" className="btn btn-stage" onClick={onNext}>
        Próxima pessoa
      </button>
      <p className="stage-hint">A tela volta para o início em {remaining}s.</p>
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
 * Calls `onIdle` once after `seconds` in which nobody touches the screen or types (null turns it
 * off). The count starts again on every touch and whenever `phase` changes.
 */
function useIdleTimeout(seconds: number | null, phase: string, onIdle: () => void): void {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (seconds === null) return;
    let timer = 0;
    const restart = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => onIdleRef.current(), seconds * 1000);
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

/**
 * Keeps the screen on while the roulette is open on a tablet or a computer, where the browser
 * allows it. Phones are left alone: there it would only drain the visitor's battery.
 */
function useScreenAwake(): void {
  useEffect(() => {
    if (!window.matchMedia('(min-width: 600px) and (min-height: 600px)').matches) return;
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
        // Refused (battery saver, page not on https): the device's own screen timeout applies.
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
