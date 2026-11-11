import { Crosshair, Lightbulb, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ParallaxBackground } from '../../live/ParallaxBackground';
import { IdeaNav } from './IdeaNav';
import { Revolver } from './Revolver';
import { mockPrize } from './ideas';
import './revolver.css';

/**
 * Prototype of a Russian-roulette draw, up for the crew to vote on: six chambers, one loaded.
 * A dry trigger turns the cylinder and the tension rises; when the loaded chamber comes up the
 * shot goes off, the barrel smokes and the prize is yours.
 *
 * Everything is mocked in the browser — the loaded chamber and the prize are drawn on the client,
 * nothing is registered and nobody wins anything.
 */

const CHAMBERS = 6;
const PULL_MS = 420;

type Phase = 'ready' | 'pulling' | 'click' | 'fired';

interface Puff {
  id: number;
  x: number;
  rise: number;
  size: number;
  scale: number;
  delay: number;
  duration: number;
  spin: number;
  blur: number;
  opacity: number;
  /** Rounds the puff unevenly, so it is a billow and not a perfect circle. */
  round: number;
}

const randomChamber = () => Math.floor(Math.random() * CHAMBERS);
const between = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * Muzzle smoke: a tight jet leaving the bore, then billows that widen as they climb. The column
 * drifts slightly to one side, because smoke rising in dead-symmetric fashion reads as a lamp,
 * not as smoke. Each puff is translucent so they stack into shape instead of merging into a blob.
 */
function makeSmoke(): Puff[] {
  const DRIFT = between(10, 22);
  return Array.from({ length: 16 }, (_, id) => {
    const jet = id < 5;
    const rise = jet ? between(-62, -34) : between(-232, -118);
    // The higher a puff goes, the further it strays from the column.
    const spread = (Math.abs(rise) / 220) * 64;
    return {
      id,
      x: DRIFT * (jet ? 0.3 : 1) + between(-spread, spread),
      rise,
      size: jet ? between(30, 52) : between(70, 130),
      scale: jet ? between(1.2, 1.7) : between(1.7, 2.7),
      delay: jet ? between(0, 0.09) : between(0.12, 0.95),
      duration: jet ? between(0.6, 1) : between(2.2, 3.4),
      spin: between(-80, 80),
      blur: jet ? between(3, 6) : between(5, 9),
      opacity: jet ? between(0.62, 0.85) : between(0.44, 0.7),
      round: Math.round(between(38, 62)),
    };
  });
}

export function RevolverPage() {
  const [loaded, setLoaded] = useState(randomChamber);
  const [position, setPosition] = useState(0);
  const [spent, setSpent] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>('ready');
  const [prize, setPrize] = useState<string | null>(null);
  const [smoke, setSmoke] = useState<Puff[]>([]);
  const [shotId, setShotId] = useState(0);

  const rigRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function kick(fired: boolean) {
    const rig = rigRef.current;
    if (!rig || reduced()) return;
    rig.animate(
      fired
        ? [
            { transform: 'translateY(0) scale(1)' },
            { transform: 'translateY(16px) scale(1.07)', offset: 0.18 },
            { transform: 'translateY(-4px) scale(0.99)', offset: 0.5 },
            { transform: 'translateY(0) scale(1)' },
          ]
        : [
            { transform: 'translateY(0)' },
            { transform: 'translateY(3px)', offset: 0.4 },
            { transform: 'translateY(0)' },
          ],
      { duration: fired ? 520 : 180, easing: 'cubic-bezier(.2,.8,.3,1)' },
    );
  }

  function pull() {
    if (phase === 'pulling' || phase === 'fired') return;
    setPhase('pulling');
    const hit = position === loaded;

    setTimeout(
      () => {
        if (!alive.current) return;
        if (hit) {
          setPrize(mockPrize());
          setSpent((current) => [...current, position]);
          setSmoke(makeSmoke());
          setShotId((id) => id + 1);
          setPhase('fired');
          kick(true);
          return;
        }
        setSpent((current) => [...current, position]);
        setPosition((current) => (current + 1) % CHAMBERS);
        setPhase('click');
        kick(false);
      },
      reduced() ? 60 : PULL_MS,
    );
  }

  function reload() {
    setLoaded(randomChamber());
    setPosition(0);
    setSpent([]);
    setPrize(null);
    setSmoke([]);
    setPhase('ready');
  }

  const left = CHAMBERS - spent.length;
  const status =
    phase === 'fired' && prize
      ? `O tiro saiu: você ganhou ${prize}.`
      : phase === 'pulling'
        ? 'Puxando o gatilho…'
        : phase === 'click'
          ? `Deu seco. O tambor girou — faltam ${left} câmaras.`
          : 'Seis câmaras, uma carregada. Puxe o gatilho.';

  return (
    <div className="revolver-page public-page">
      <ParallaxBackground image="/brand/stage-pattern.webp" />

      <header className="revolver-hero">
        <span className="badge badge-muted revolver-tag">
          <Lightbulb size={16} aria-hidden="true" /> Ideia em votação
        </span>
        <h1>Roleta-russa</h1>
        <p>
          Seis câmaras, uma carregada. Gatilho seco gira o tambor e você tenta de novo; quando o tiro sai, o brinde é
          seu.
        </p>
        <p className="revolver-note">
          Protótipo para a galera escolher. A câmara carregada e o brinde são sorteados aqui no navegador, só para
          testar: não vale brinde e nada é registrado.
        </p>
      </header>

      <main className="revolver-main">
        <div className={`revolver-stage phase-${phase}`}>
          <div className="revolver-rig" ref={rigRef}>
            <Revolver spent={spent} position={position} />

            <div className="revolver-muzzle" aria-hidden="true">
              {phase === 'fired' && (
                <div className="revolver-smoke" key={shotId}>
                  <span className="revolver-flash" />
                  <span className="revolver-haze" />
                  {smoke.map((puff) => (
                    <i
                      key={puff.id}
                      className="revolver-puff"
                      style={
                        {
                          '--puff-x': `${puff.x}px`,
                          '--puff-rise': `${puff.rise}px`,
                          '--puff-size': `${puff.size}px`,
                          '--puff-scale': puff.scale,
                          '--puff-delay': `${puff.delay}s`,
                          '--puff-duration': `${puff.duration}s`,
                          '--puff-spin': `${puff.spin}deg`,
                          '--puff-blur': `${puff.blur}px`,
                          '--puff-opacity': puff.opacity,
                          '--puff-round': `${puff.round}%`,
                        } as CSSProperties
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {phase === 'fired' && prize ? (
            <p className="revolver-prize">
              <span>Saiu o tiro</span>
              <strong>{prize}</strong>
            </p>
          ) : null}
        </div>

        <div className="revolver-panel">
          <p className="revolver-chambers-left">
            <span className="revolver-dots" aria-hidden="true">
              {Array.from({ length: CHAMBERS }, (_, index) => (
                <i key={index} className={spent.includes(index) ? 'is-spent' : ''} />
              ))}
            </span>
            {phase === 'fired' ? 'Tambor descarregado' : `${left} de ${CHAMBERS} câmaras por abrir`}
          </p>

          <p className="revolver-status" aria-live="polite">
            {status}
          </p>

          <div className="revolver-controls">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={pull}
              disabled={phase === 'pulling' || phase === 'fired'}
            >
              <Crosshair size={20} aria-hidden="true" /> Puxar o gatilho
            </button>
            <button type="button" className="btn btn-secondary btn-lg" onClick={reload} disabled={phase === 'pulling'}>
              <RotateCcw size={20} aria-hidden="true" /> Girar o tambor
            </button>
          </div>
        </div>
      </main>

      <IdeaNav current="revolver" />
    </div>
  );
}
