import { Dices, Lightbulb, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ParallaxBackground } from '../../live/ParallaxBackground';
import { useConfetti } from '../../live/useConfetti';
import { IdeaNav } from './IdeaNav';
import { mockPrize } from './ideas';
import './dice.css';

/**
 * Prototype of a dice duel, up for the crew to vote on: you roll three dice, the house answers
 * with three, and the bigger sum takes the prize. Written from the dice reference in `ideias/`,
 * rebuilt in this project's stack and brand.
 *
 * Everything is mocked in the browser: the rolls and the prize are drawn on the client, nothing
 * is registered and nobody wins anything.
 */

/** Dice each side throws. */
const ROLLS = 3;
const TOSS_MS = 1100;

type Side = 'you' | 'house';

interface Game {
  you: number[];
  house: number[];
  turn: Side | 'done';
  busy: boolean;
  winner: Side | 'tie' | null;
  prize: string | null;
}

/** One throw: the landed face plus where the die lands and how much it spins getting there. */
interface Toss {
  id: number;
  face: number;
  dx: number;
  dy: number;
  rz: number;
  tx: number;
  ty: number;
}

type DieFace = 1 | 2 | 3 | 4 | 5 | 6;

/** Which of the nine cells of a face carry a pip (opposite faces sum to 7). */
const PIPS: Record<DieFace, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

const FACES: readonly DieFace[] = [1, 2, 3, 4, 5, 6];
const CELLS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const SIDES: readonly Side[] = ['you', 'house'];

const freshGame = (): Game => ({ you: [], house: [], turn: 'you', busy: false, winner: null, prize: null });
const restingToss = (): Toss => ({ id: 0, face: 5, dx: 0, dy: 0, rz: 0, tx: 2, ty: -2 });

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
const between = (min: number, max: number) => min + Math.random() * (max - min);
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const named = (side: Side) => (side === 'you' ? 'Você' : 'A Casa');
const total = (rolls: readonly number[]) => rolls.reduce((sum, face) => sum + face, 0);

/** A die lying on the table: the same pip layout as the thrown one, flat. */
function FlatDie({ face }: { face: DieFace | null }) {
  return (
    <span className={`dice-flat ${face === null ? 'is-empty' : ''}`} aria-hidden="true">
      {face === null
        ? null
        : CELLS.map((cell) => <span key={cell} className="dice-pip" data-on={PIPS[face].includes(cell) ? '' : undefined} />)}
    </span>
  );
}

export function DicePage() {
  const [game, setGame] = useState<Game>(freshGame);
  const [toss, setToss] = useState<Toss>(restingToss);
  const [status, setStatus] = useState('Sua vez. Role os três dados.');
  const { canvasRef, celebrate } = useConfetti();

  // The async house turn reads the live game from here, so a captured render can never go stale.
  const gameRef = useRef(game);
  const trayRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  function commit(next: Game) {
    gameRef.current = next;
    setGame(next);
  }

  /** Throws the die and resolves with the face it landed on, once the animation is over. */
  async function throwDie(): Promise<DieFace> {
    const face = ((1 + Math.floor(Math.random() * 6)) as DieFace);
    const tray = trayRef.current;
    const reach = tray ? Math.round(Math.max(20, Math.min(80, tray.clientWidth / 2 - 90))) : 40;
    setToss((current) => ({
      id: current.id + 1,
      face,
      dx: Math.round(between(-reach, reach)),
      dy: Math.round(between(-46, 46)),
      rz: Math.round(between(-35, 35)),
      tx: 2 + Math.floor(Math.random() * 3),
      ty: -2 - Math.floor(Math.random() * 3),
    }));
    await wait(reducedMotion() ? 150 : TOSS_MS);
    return face;
  }

  function decide() {
    const current = gameRef.current;
    const mine = total(current.you);
    const theirs = total(current.house);
    const winner: Side | 'tie' = mine > theirs ? 'you' : theirs > mine ? 'house' : 'tie';
    const prize = winner === 'you' ? mockPrize() : null;
    commit({ ...current, turn: 'done', busy: false, winner, prize });
    setStatus(
      winner === 'you'
        ? `${mine} a ${theirs}: você ganhou ${prize}.`
        : winner === 'house'
          ? `${theirs} a ${mine} para a Casa. Não foi dessa vez.`
          : `Empate em ${mine}. Ninguém leva o brinde.`,
    );
    if (winner === 'you') celebrate();
  }

  async function houseTurn() {
    setStatus('A Casa responde.');
    for (let roll = 0; roll < ROLLS; roll++) {
      await wait(reducedMotion() ? 120 : 600);
      if (!alive.current) return;
      const face = await throwDie();
      if (!alive.current) return;
      const house = [...gameRef.current.house, face];
      commit({ ...gameRef.current, house });
      setStatus(`A Casa tirou ${face} — soma ${total(house)}.`);
    }
    await wait(reducedMotion() ? 120 : 650);
    if (!alive.current) return;
    decide();
  }

  async function roll() {
    const current = gameRef.current;
    if (current.busy || current.turn !== 'you' || current.you.length >= ROLLS) return;
    commit({ ...current, busy: true });
    const face = await throwDie();
    if (!alive.current) return;
    const you = [...gameRef.current.you, face];
    const complete = you.length >= ROLLS;
    commit({ ...gameRef.current, you, busy: complete, turn: complete ? 'house' : 'you' });
    setStatus(
      complete
        ? `Você somou ${total(you)}. Agora é a Casa.`
        : `Você tirou ${face} — soma ${total(you)}. Faltam ${ROLLS - you.length}.`,
    );
    if (complete) void houseTurn();
  }

  function reset() {
    commit(freshGame());
    setToss(restingToss);
    setStatus('Sua vez. Role os três dados.');
  }

  useEffect(() => {
    // Registered once: the handler reads the live game from gameRef, not from this render.
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      // Enter and Space already activate a focused button: let the browser do it.
      if (target instanceof HTMLElement && ['BUTTON', 'INPUT', 'TEXTAREA', 'A'].includes(target.tagName)) return;
      const key = event.key.toLowerCase();
      if (key === 'enter' || key === ' ') {
        event.preventDefault();
        void roll();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const myTurn = game.turn === 'you' && !game.busy;
  const tossStyle = {
    '--dice-dx': `${toss.dx}px`,
    '--dice-dy': `${toss.dy}px`,
    '--dice-rz': `${toss.rz}deg`,
    '--dice-tx': toss.tx,
    '--dice-ty': toss.ty,
  } as CSSProperties;

  return (
    <div className="dice-page public-page">
      <ParallaxBackground image="/brand/stage-pattern.webp" />
      <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />

      <header className="dice-hero">
        <span className="badge badge-muted dice-tag">
          <Lightbulb size={16} aria-hidden="true" /> Ideia em votação
        </span>
        <h1>Duelo de dados</h1>
        <p>
          Você rola três dados, a Casa rola outros três. Quem somar mais leva o brinde. Empate, joga de novo.
        </p>
        <p className="dice-note">
          Protótipo de um tipo de sorteio novo, para a galera escolher. Ainda não vale brinde: nada aqui é registrado.
        </p>
      </header>

      <main className="dice-main">
        <section className="card dice-scores" aria-label="Placar">
          {SIDES.map((side) => {
            const rolls = side === 'you' ? game.you : game.house;
            const active = game.turn === side && !game.winner;
            return (
              <div key={side} className={`dice-score ${active ? 'is-turn' : ''} ${game.winner === side ? 'is-winner' : ''}`}>
                <div className="dice-score-top">
                  <span className="dice-score-name">{named(side)}</span>
                  <span className="dice-score-value">{total(rolls)}</span>
                </div>
                <div className="dice-roll-row">
                  {Array.from({ length: ROLLS }, (_, index) => (
                    <FlatDie key={index} face={(rolls[index] as DieFace | undefined) ?? null} />
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        <section className="dice-tray" ref={trayRef} aria-label="Mesa">
          <div key={toss.id} className={`dice-toss ${toss.id > 0 ? 'is-rolling' : ''}`} style={tossStyle}>
            <div className="dice-cube" data-face={toss.face} role="img" aria-label={`Dado mostrando ${toss.face}`}>
              {FACES.map((face) => (
                <div key={face} className={`dice-face dice-face-${face}`}>
                  {CELLS.map((cell) => (
                    <span key={cell} className="dice-pip" data-on={PIPS[face].includes(cell) ? '' : undefined} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <p className="dice-status" aria-live="polite">
            {status}
          </p>

          {game.winner ? (
            <div className="dice-result">
              <h2>
                {game.winner === 'you' ? 'Você ganhou' : game.winner === 'house' ? 'A Casa ganhou' : 'Empate'}
              </h2>
              <p className={game.winner === 'you' ? 'dice-result-prize' : ''}>
                {game.winner === 'you'
                  ? game.prize
                  : game.winner === 'house'
                    ? `${total(game.house)} a ${total(game.you)}. Não foi dessa vez.`
                    : `${total(game.you)} a ${total(game.house)}. Ninguém leva: role de novo.`}
              </p>
              <button type="button" className="btn btn-primary" onClick={reset}>
                <RotateCcw size={18} aria-hidden="true" />{' '}
                {game.winner === 'tie' ? 'Desempatar' : 'Jogar de novo'}
              </button>
            </div>
          ) : null}
        </section>

        <div className="dice-controls">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => void roll()} disabled={!myTurn}>
            <Dices size={20} aria-hidden="true" /> Rolar o dado
          </button>
          <button type="button" className="btn btn-secondary btn-lg" onClick={reset} disabled={game.busy}>
            <RotateCcw size={20} aria-hidden="true" /> Começar de novo
          </button>
        </div>
        <p className="dice-keys small">Atalho: Enter ou Espaço para rolar.</p>
      </main>

      <IdeaNav current="dice" />
    </div>
  );
}
