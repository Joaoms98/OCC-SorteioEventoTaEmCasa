import { Club, Diamond, Heart, Lightbulb, RotateCcw, Spade, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ParallaxBackground } from '../../live/ParallaxBackground';
import { useConfetti } from '../../live/useConfetti';
import { IdeaNav } from './IdeaNav';
import { mockPrize } from './ideas';
import './cards.css';

/**
 * Prototype of a card-deck draw, up for the crew to vote on: pick a card from the fan, it turns
 * over and the prize is printed on it. Built like a real playing card — rank and suit in opposite
 * corners, the suit watermarked behind the prize, an ornamented back — in the OCC colours.
 *
 * Everything is mocked in the browser: the prize is drawn on the client, nothing is registered.
 */

const DECK_SIZE = 5;
const FLIP_MS = 700;

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
type Suit = (typeof SUITS)[number];

const SUIT_ICON: Record<Suit, LucideIcon> = { spades: Spade, hearts: Heart, diamonds: Diamond, clubs: Club };
const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7'];

interface PlayingCard {
  rank: string;
  suit: Suit;
}

type Phase = 'deck' | 'flipping' | 'revealed';

/** A hand of distinct cards, so no two cards in the fan look the same. */
function dealHand(size: number): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = deck[i];
    const b = deck[j];
    if (a && b) {
      deck[i] = b;
      deck[j] = a;
    }
  }
  return deck.slice(0, size);
}

function CornerMark({ card }: { card: PlayingCard }) {
  const Icon = SUIT_ICON[card.suit];
  return (
    <span className="cards-corner">
      <b>{card.rank}</b>
      <Icon size={13} aria-hidden="true" fill="currentColor" strokeWidth={1} />
    </span>
  );
}

export function CardsPage() {
  const [hand, setHand] = useState<PlayingCard[]>(() => dealHand(DECK_SIZE));
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

  function shuffle() {
    setHand(dealHand(DECK_SIZE));
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
          {hand.map((card, index) => {
            const isChosen = chosen === index;
            const Icon = SUIT_ICON[card.suit];
            const slotStyle = {
              '--card-angle': `${(index - center) * 7}deg`,
              '--card-lift': `${Math.abs(index - center) * 12}px`,
              '--card-z': `${DECK_SIZE - Math.abs(index - center)}`,
            } as CSSProperties;
            return (
              <button
                key={`${card.rank}-${card.suit}`}
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
                    <span className="cards-back-art">
                      <span className="cards-medallion">
                        <img src="/brand/occ-round.webp" alt="" width={44} height={44} />
                      </span>
                    </span>
                  </span>

                  <span className={`cards-face cards-front cards-suit-${card.suit}`} aria-hidden="true">
                    <CornerMark card={card} />
                    <Icon className="cards-watermark" size={120} aria-hidden="true" fill="currentColor" strokeWidth={0} />
                    {isChosen && prize ? (
                      <span className="cards-prize">
                        <span className="cards-prize-label">Você ganhou</span>
                        <strong className="cards-prize-name">{prize}</strong>
                      </span>
                    ) : null}
                    <CornerMark card={card} />
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
          <button type="button" className="btn btn-primary btn-lg" onClick={shuffle} disabled={phase === 'deck'}>
            <RotateCcw size={20} aria-hidden="true" /> Embaralhar de novo
          </button>
        </div>
      </main>

      <IdeaNav current="cards" />
    </div>
  );
}
