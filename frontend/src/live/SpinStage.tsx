import { useEffect, useRef, useState, type ReactNode } from 'react';
import { assetUrl } from '../api/httpClient';
import { PrizeUnlockedCard } from '../components/prize/PrizeUnlockedCard';
import type { InteractiveSpin } from '../types/api';
import { InteractiveWheel, type InteractiveWheelHandle, type WheelPhase } from './InteractiveWheel';
import { ParallaxBackground } from './ParallaxBackground';
import { useConfetti } from './useConfetti';

interface SpinStageProps {
  eventName: string;
  participantName: string;
  spin: InteractiveSpin;
  /** The wheel had already been spun when the screen opened: show the prize without celebrating again. */
  alreadyLanded?: boolean;
  onLanded(): void;
  /** Under the winner's name: how to get the prize. */
  pickupNote: string;
  /** Under the prize once the wheel stops: links on a personal device, the next person at the booth. */
  resultActions: ReactNode;
}

/**
 * Interactive roulette on screen: the participant spins the wheel (mouse or finger) and sees the
 * prize. The prize was drawn by the server at registration; the spin only reveals it.
 */
export function SpinStage({ eventName, participantName, spin, alreadyLanded = false, onLanded, pickupNote, resultActions }: SpinStageProps) {
  const wheelRef = useRef<InteractiveWheelHandle>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  // What the wheel was when the screen opened: reopening after the spin must not celebrate again.
  const openedLanded = useRef(alreadyLanded);
  const [phase, setPhase] = useState<WheelPhase>(alreadyLanded ? 'landed' : 'ready');
  const [weakThrow, setWeakThrow] = useState(false);
  const { canvasRef, celebrate } = useConfetti();
  const firstName = participantName.split(' ')[0] ?? participantName;

  function handlePhase(next: WheelPhase) {
    setPhase(next);
    if (next !== 'ready') setWeakThrow(false);
    if (next === 'landed') {
      celebrate();
      onLanded();
    }
  }

  // On a phone the prize card is below the wheel: bring it into view when the wheel stops.
  useEffect(() => {
    if (phase === 'landed' && !openedLanded.current) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [phase]);

  const waiting = phase === 'ready' || phase === 'dragging';

  return (
    <div className="stage stage-with-pattern">
      <ParallaxBackground image="/brand/stage-pattern.webp" />
      <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />

      <header className="stage-header">
        <div className="stage-header-side" />
        <div className="stage-title">
          <img src="/brand/occ-round.webp" alt="Os Crema Culture" width={64} height={64} />
          <div>
            <h1>{eventName}</h1>
            <span className="live-badge live-badge-off">Roleta interativa</span>
          </div>
        </div>
        <div className="stage-header-side" />
      </header>

      <main className={`spin-main ${phase === 'landed' ? 'spin-main-landed' : ''}`}>
        {phase !== 'landed' && (
          <div className="spin-prompt" aria-live="polite">
            <p className="stage-prize-name">{waiting ? `${firstName}, é a sua vez!` : 'Girando…'}</p>
            <div className={`stage-name ${waiting ? 'stage-name-idle' : 'stage-name-drawing'}`}>
              {waiting ? 'Gire a roleta' : 'Boa sorte!'}
            </div>
            {waiting && <p className="stage-hint">Arraste a roleta e solte para girar.</p>}
          </div>
        )}

        <div className="spin-wheel">
          <InteractiveWheel
            ref={wheelRef}
            prizes={spin.wheel}
            prizeId={spin.prize.id}
            seed={spin.drawId}
            landed={openedLanded.current}
            onPhaseChange={handlePhase}
            onWeakThrow={() => setWeakThrow(true)}
          />
        </div>

        <div className="spin-result" ref={resultRef} aria-live="polite">
          {phase === 'landed' ? (
            <>
              <PrizeUnlockedCard title="Você ganhou!" imageUrl={spin.prize.imageUrl ? assetUrl(spin.prize.imageUrl) : null}>
                <div className="stage-name stage-name-revealed stage-name-card">{spin.prize.name}</div>
                <p className="stage-prize-name">Parabéns, {participantName}!</p>
                <p className="prize-status">{pickupNote}</p>
              </PrizeUnlockedCard>
              {resultActions}
            </>
          ) : (
            waiting && (
              <>
                {weakThrow && <p className="stage-message stage-message-info">Quase! Gire com mais força.</p>}
                <button type="button" className="btn btn-stage" disabled={phase === 'dragging'} onClick={() => wheelRef.current?.spin()}>
                  Girar a roleta
                </button>
              </>
            )
          )}
        </div>
      </main>
    </div>
  );
}
