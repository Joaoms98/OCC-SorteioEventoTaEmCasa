import { Dices, Hand, Lightbulb, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ParallaxBackground } from '../../live/ParallaxBackground';
import { useConfetti } from '../../live/useConfetti';
import { IdeaNav } from './IdeaNav';
import './dice.css';

/**
 * Prototype of a possible new draw type, up for the crew to vote on: a die instead of a wheel.
 * Rebuilt in this project's stack and brand from the dice reference kept in `ideias/`.
 * Nothing here talks to the API: it draws no prize, registers nobody and awards nothing.
 */

const TARGET = 50;
/** The house stops pressing its luck once the bank is worth more than another roll. */
const HOUSE_BANK_LIMIT = 15;
const TOSS_MS = 1100;

type Side = 'you' | 'house';

interface Game {
  you: number;
  house: number;
  /** Points of the current turn, lost on a 1 and banked on hold. */
  bank: number;
  turn: Side;
  busy: boolean;
  winner: Side | null;
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

interface LogLine {
  id: number;
  text: string;
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

const freshGame = (): Game => ({ you: 0, house: 0, bank: 0, turn: 'you', busy: false, winner: null });
const restingToss = (): Toss => ({ id: 0, face: 5, dx: 0, dy: 0, rz: 0, tx: 2, ty: -2 });

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
const between = (min: number, max: number) => min + Math.random() * (max - min);
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const named = (side: Side) => (side === 'you' ? 'Você' : 'A Casa');

export function DicePage() {
  const [game, setGame] = useState<Game>(freshGame);
  const [toss, setToss] = useState<Toss>(restingToss);
  const [log, setLog] = useState<LogLine[]>([]);
  const [status, setStatus] = useState('Sua vez. Role o dado para começar.');
  const { canvasRef, celebrate } = useConfetti();

  // The async turns read the live game from here, so a captured render can never go stale.
  const gameRef = useRef(game);
  const trayRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const lineId = useRef(0);

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

  function addLine(text: string) {
    lineId.current += 1;
    const line = { id: lineId.current, text };
    setLog((current) => [line, ...current].slice(0, 7));
  }

  function shakeTray() {
    const tray = trayRef.current;
    if (!tray || reducedMotion()) return;
    tray.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-8px)' },
        { transform: 'translateX(8px)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 400, easing: 'ease-in-out' },
    );
  }

  /** Throws the die and resolves with the face it landed on, once the animation is over. */
  async function throwDie(): Promise<number> {
    const face = 1 + Math.floor(Math.random() * 6);
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

  async function bust(side: Side) {
    addLine(`${named(side)} tirou 1 e perdeu o cofre`);
    commit({ ...gameRef.current, bank: 0 });
    setStatus(side === 'you' ? 'Tirou 1. Cofre perdido, vez da Casa.' : 'A Casa tirou 1 e perdeu o cofre. Sua vez.');
    shakeTray();
    await wait(reducedMotion() ? 300 : 900);
    if (!alive.current) return;
    passTurn();
  }

  function passTurn() {
    const current = gameRef.current;
    const turn: Side = current.turn === 'you' ? 'house' : 'you';
    commit({ ...current, turn, bank: 0, busy: turn === 'house' });
    if (turn === 'house') {
      void houseTurn();
      return;
    }
    setStatus((shown) => (shown.includes('Sua vez') ? shown : 'Sua vez. Role ou guarde.'));
  }

  function hold(side: Side) {
    const current = gameRef.current;
    if (current.busy && side === 'you') return;
    if (current.bank === 0 || current.winner) return;
    const gained = current.bank;
    const score = (side === 'you' ? current.you : current.house) + gained;
    const banked: Game =
      side === 'you' ? { ...current, you: score, bank: 0 } : { ...current, house: score, bank: 0 };
    addLine(`${named(side)} guardou ${gained} — total ${score}`);

    if (score >= TARGET) {
      commit({ ...banked, busy: false, winner: side });
      setStatus(side === 'you' ? 'Você chegou a 50. Fim de jogo.' : 'A Casa chegou a 50. Fim de jogo.');
      if (side === 'you') celebrate();
      return;
    }
    commit(banked);
    setStatus(side === 'you' ? `Guardou ${gained}. Vez da Casa.` : `A Casa guardou ${gained}. Sua vez.`);
    passTurn();
  }

  async function playerRoll() {
    const current = gameRef.current;
    if (current.busy || current.winner || current.turn !== 'you') return;
    commit({ ...current, busy: true });
    const face = await throwDie();
    if (!alive.current) return;
    if (face === 1) {
      await bust('you');
      return;
    }
    const bank = gameRef.current.bank + face;
    commit({ ...gameRef.current, bank, busy: false });
    addLine(`Você tirou ${face} — ${bank} no cofre`);
    setStatus(`Cofre em ${bank}. Role de novo ou guarde.`);
  }

  async function houseTurn() {
    setStatus('A Casa está rolando.');
    await wait(reducedMotion() ? 200 : 800);
    while (alive.current && !gameRef.current.winner && gameRef.current.turn === 'house') {
      const face = await throwDie();
      if (!alive.current) return;
      if (face === 1) {
        await bust('house');
        return;
      }
      const bank = gameRef.current.bank + face;
      commit({ ...gameRef.current, bank });
      addLine(`A Casa tirou ${face} — ${bank} no cofre`);
      if (gameRef.current.house + bank >= TARGET || bank >= HOUSE_BANK_LIMIT) {
        await wait(reducedMotion() ? 200 : 700);
        if (!alive.current) return;
        hold('house');
        return;
      }
      await wait(reducedMotion() ? 150 : 600);
    }
  }

  function reset() {
    commit(freshGame());
    setToss(restingToss);
    setLog([]);
    setStatus('Sua vez. Role o dado para começar.');
  }

  useEffect(() => {
    // Registered once: the handlers below read the live game from gameRef, not from this render.
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      // Enter and Space already activate a focused button: let the browser do it.
      if (target instanceof HTMLElement && ['BUTTON', 'INPUT', 'TEXTAREA', 'A'].includes(target.tagName)) return;
      const key = event.key.toLowerCase();
      if (key === 'enter' || key === ' ') {
        event.preventDefault();
        void playerRoll();
      }
      if (key === 'g') {
        event.preventDefault();
        hold('you');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const myTurn = game.turn === 'you' && !game.busy && !game.winner;
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
        <h1>Guarda ou Rola</h1>
        <p>
          Cada rolagem soma ao cofre. Tirou 1, o cofre vai embora. Guarde para somar ao placar. Quem chegar a {TARGET}{' '}
          primeiro ganha.
        </p>
        <p className="dice-note">
          Protótipo de um tipo de sorteio novo, para a galera escolher. Ainda não vale brinde: nada aqui é registrado.
        </p>
      </header>

      <main className="dice-main">
        <section className="card dice-scores" aria-label="Placar">
          {SIDES.map((side) => {
            const score = side === 'you' ? game.you : game.house;
            return (
              <div key={side} className={`dice-score ${game.turn === side && !game.winner ? 'is-turn' : ''}`}>
                <div className="dice-score-top">
                  <span className="dice-score-name">{named(side)}</span>
                  <span className="dice-score-value">{score}</span>
                </div>
                <div className="dice-track">
                  <div className="dice-fill" style={{ width: `${Math.min(100, (score / TARGET) * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </section>

        <section className="dice-tray" ref={trayRef} aria-label="Mesa">
          <div className="dice-bank">
            <strong>{game.bank}</strong>
            <span>no cofre</span>
          </div>

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

          {game.winner && (
            <div className="dice-result">
              <h2>{game.winner === 'you' ? 'Você ganhou' : 'A Casa ganhou'}</h2>
              <p>
                Placar final: você {game.you}, Casa {game.house}.
              </p>
              <button type="button" className="btn btn-primary" onClick={reset}>
                <RotateCcw size={18} aria-hidden="true" /> Jogar de novo
              </button>
            </div>
          )}
        </section>

        <div className="dice-controls">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => void playerRoll()} disabled={!myTurn}>
            <Dices size={20} aria-hidden="true" /> Rolar o dado
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-lg"
            onClick={() => hold('you')}
            disabled={!myTurn || game.bank === 0}
          >
            <Hand size={20} aria-hidden="true" /> Guardar{game.bank > 0 ? ` ${game.bank}` : ''}
          </button>
        </div>
        <p className="dice-keys small">Atalhos: Enter ou Espaço para rolar, G para guardar.</p>

        <section className="card dice-log" aria-label="Últimas rolagens">
          <h2>Últimas rolagens</h2>
          {log.length === 0 ? (
            <p className="muted">Nenhuma rolagem ainda.</p>
          ) : (
            <ul>
              {log.map((line) => (
                <li key={line.id}>{line.text}</li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <IdeaNav current="dice" />
    </div>
  );
}
