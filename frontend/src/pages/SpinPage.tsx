import { Radio } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { assetUrl } from '../api/httpClient';
import { PrizeUnlockedCard } from '../components/prize/PrizeUnlockedCard';
import { InteractiveWheel, type InteractiveWheelHandle, type WheelPhase } from '../live/InteractiveWheel';
import { ParallaxBackground } from '../live/ParallaxBackground';
import { useConfetti } from '../live/useConfetti';
import { readSpin, saveSpin, type StoredSpin } from '../registration/registrationStorage';
import { publicPaths } from '../routes';

/**
 * Interactive roulette: right after registering, the participant spins the wheel (mouse or finger)
 * and sees the prize. The prize was drawn by the server at registration; the spin only reveals it.
 */
export function SpinPage() {
  const { eventId = '' } = useParams();
  const [spin, setSpin] = useState<StoredSpin | null>(() => readSpin(eventId));

  // Nothing to spin on this device: registering is the way in.
  if (!spin) return <Navigate to={publicPaths.register(eventId)} replace />;

  function markLanded(current: StoredSpin) {
    const landed = { ...current, landed: true };
    saveSpin(eventId, landed);
    setSpin(landed);
  }

  return <SpinStage eventId={eventId} spin={spin} onLanded={() => markLanded(spin)} />;
}

function SpinStage({ eventId, spin, onLanded }: { eventId: string; spin: StoredSpin; onLanded(): void }) {
  const wheelRef = useRef<InteractiveWheelHandle>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  // What the wheel was when the page opened: reopening after the spin must not celebrate again.
  const openedLanded = useRef(spin.landed);
  const [phase, setPhase] = useState<WheelPhase>(spin.landed ? 'landed' : 'ready');
  const [weakThrow, setWeakThrow] = useState(false);
  const { canvasRef, celebrate } = useConfetti();
  const firstName = spin.participantName.split(' ')[0] ?? spin.participantName;

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
            <h1>{spin.eventName}</h1>
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
                <p className="stage-prize-name">Parabéns, {spin.participantName}!</p>
                <p className="prize-status">Mostre esta tela para a organização e retire o seu brinde.</p>
              </PrizeUnlockedCard>
              <nav className="spin-links" aria-label="Outras páginas">
                <Link to={publicPaths.live(eventId)} className="stage-link">
                  <Radio size={16} aria-hidden="true" /> Acompanhar ao vivo
                </Link>
                <Link to={publicPaths.home} className="stage-link">
                  Ver todos os sorteios
                </Link>
              </nav>
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
