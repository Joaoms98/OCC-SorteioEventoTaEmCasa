import { Lightbulb, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ParallaxBackground } from '../../live/ParallaxBackground';
import { useConfetti } from '../../live/useConfetti';
import { IdeaNav } from './IdeaNav';
import { mockPrize } from './ideas';
import './cards.css';

/**
 * Prototype of a card-deck draw, up for the crew to vote on: pick a card from the fan, it turns
 * over and shows the prize. Everything is mocked in the browser — the prize is drawn on the client,
 * nothing is registered and nobody wins anything. The real draw would come from the server.
 *
 * The 3D turn and the shine sweeping the back come from the card reference kept in `ideias/`;
 * the artwork is ours.
 */

const DECK_SIZE = 5;
const FLIP_MS = 700;

type Phase = 'deck' | 'flipping' | 'revealed';

export function CardsPage() {
  const [phase, setPhase] = useState<Phase>('deck');
  const [chosen, setChosen] = useState<number | null>(null);
  const [prize, setPrize] = useState<string | null>(null);
  const [round, setRound] = useState(1);
  const { canvasRef, celebrate } = useConfetti();
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  function pick(index: number) {
    if (phase !== 'deck') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPrize(mockPrize());
    setChosen(index);
    setPhase('flipping');
    setTimeout(
      () => {
        if (!alive.current) return;
        setPhase('revealed');
        celebrate();
      },
      reduced ? 60 : FLIP_MS,
    );
  }

  function reset() {
    setPhase('deck');
    setChosen(null);
    setPrize(null);
    setRound((current) => current + 1);
  }

  const center = (DECK_SIZE - 1) / 2;

  return (
    <div className="cards-page public-page">
      <ParallaxBackground image="/brand/stage-pattern.webp" />
      <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />

      <header className="cards-hero">
        <span className="badge badge-muted cards-tag">
          <Lightbulb size={16} aria-hidden="true" /> Ideia em votação
        </span>
        <h1>Baralho</h1>
        <p>Escolha uma carta do baralho. Ela vira na hora e mostra o brinde que saiu para você.</p>
        <p className="cards-note">
          Protótipo para a galera escolher. O brinde é sorteado aqui no navegador, só para testar: não vale nada e
          nada é registrado.
        </p>
      </header>

      <main className="cards-main">
        <div className="cards-deck" key={round}>
          {Array.from({ length: DECK_SIZE }, (_, index) => {
            const isChosen = chosen === index;
            const slotStyle = {
              '--card-angle': `${(index - center) * 7}deg`,
              '--card-lift': `${Math.abs(index - center) * 12}px`,
              '--card-z': `${DECK_SIZE - Math.abs(index - center)}`,
            } as CSSProperties;
            return (
              <button
                key={index}
                type="button"
                className={`cards-slot ${isChosen ? 'is-chosen' : ''} ${chosen !== null && !isChosen ? 'is-dismissed' : ''}`}
                style={slotStyle}
                onClick={() => pick(index)}
                disabled={phase !== 'deck'}
                aria-label={
                  isChosen && prize ? `Sua carta: ${prize}` : `Carta ${index + 1} de ${DECK_SIZE}, virada para baixo`
                }
              >
                <span className="cards-card">
                  <span className="cards-face cards-back" aria-hidden="true">
                    <img src="/brand/occ-round.webp" alt="" width={56} height={56} />
                  </span>
                  <span className="cards-face cards-front" aria-hidden="true">
                    <em className="cards-corner">OCC</em>
                    {isChosen && prize ? (
                      <>
                        <span className="cards-front-label">Você ganhou</span>
                        <strong className="cards-front-prize">{prize}</strong>
                      </>
                    ) : null}
                    <em className="cards-corner cards-corner-end">OCC</em>
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="cards-status" aria-live="polite">
          {phase === 'revealed' && prize
            ? `Você ganhou: ${prize}.`
            : phase === 'flipping'
              ? 'Virando a carta…'
              : 'Escolha uma carta.'}
        </p>

        <div className="cards-controls">
          <button type="button" className="btn btn-primary btn-lg" onClick={reset} disabled={phase === 'deck'}>
            <RotateCcw size={20} aria-hidden="true" /> Embaralhar de novo
          </button>
        </div>
      </main>

      <IdeaNav current="cards" />
    </div>
  );
}
