import { Coffee, Crown, Eye, Leaf, Lightbulb, RotateCcw, Shirt, Sticker, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ParallaxBackground } from '../../live/ParallaxBackground';
import { useConfetti } from '../../live/useConfetti';
import { IdeaNav } from './IdeaNav';
import { ScratchField } from './ScratchField';
import './scratch.css';

/**
 * Prototype of a scratch-card draw, up for the crew to vote on, built like the real thing: six
 * covered fields, three equal symbols give you the prize, and a separate "extra chance" field that
 * pays on its own. A coin follows the pointer and rubs the coating off.
 *
 * Everything is mocked in the browser — the ticket is dealt on the client, nothing is registered
 * and nobody wins anything. In the real draw the server would decide, like in every other mode.
 */

interface Mark {
  key: string;
  icon: LucideIcon;
  name: string;
  prize: string;
}

/** Each symbol stands for one prize, the way the printed values do on a real ticket. */
const MARKS: readonly Mark[] = [
  { key: 'shirt', icon: Shirt, name: 'Camiseta', prize: 'Camiseta OCC' },
  { key: 'mug', icon: Coffee, name: 'Caneca', prize: 'Caneca OCC' },
  { key: 'sticker', icon: Sticker, name: 'Adesivos', prize: 'Cartela de adesivos' },
  { key: 'cap', icon: Crown, name: 'Boné', prize: 'Boné OCC' },
  { key: 'kit', icon: Leaf, name: 'Kit', prize: 'Kit de cabelo' },
];

const FIELDS = 6;
/** Mocked odds, generous on purpose so the prototype is fun to try out. */
const WIN_CHANCE = 0.5;
const EXTRA_CHANCE = 0.25;

interface Ticket {
  id: number;
  marks: Mark[];
  /** Prize of the three-of-a-kind, when the ticket has one. */
  prize: string | null;
  /** The extra chance pays by itself, like the circle on a real ticket. */
  extra: string | null;
}

function at<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (!item) throw new Error('índice fora da lista');
  return item;
}

function shuffled<T>(list: readonly T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = at(copy, i);
    copy[i] = at(copy, j);
    copy[j] = a;
  }
  return copy;
}

let ticketCount = 0;

function dealTicket(): Ticket {
  ticketCount += 1;
  const pool = shuffled(MARKS);
  const wins = Math.random() < WIN_CHANCE;
  // Winning: three of one symbol, and the rest arranged so nothing else reaches three.
  // Losing: three different symbols, twice each.
  const marks = wins
    ? shuffled([at(pool, 0), at(pool, 0), at(pool, 0), at(pool, 1), at(pool, 1), at(pool, 2)])
    : shuffled([at(pool, 0), at(pool, 0), at(pool, 1), at(pool, 1), at(pool, 2), at(pool, 2)]);
  return {
    id: ticketCount,
    marks,
    prize: wins ? at(pool, 0).prize : null,
    extra: Math.random() < EXTRA_CHANCE ? at(pool, Math.floor(Math.random() * pool.length)).prize : null,
  };
}

const serial = (id: number) => `OCC-${String(id).padStart(4, '0')}`;

export function ScratchPage() {
  const [ticket, setTicket] = useState<Ticket>(dealTicket);
  const [opened, setOpened] = useState(0);
  const [extraOpen, setExtraOpen] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  const { canvasRef, celebrate } = useConfetti();

  const stageRef = useRef<HTMLDivElement>(null);
  const coinRef = useRef<HTMLDivElement>(null);
  const done = opened >= FIELDS;

  useEffect(() => {
    if (done && ticket.prize) celebrate();
  }, [done, ticket.prize, celebrate]);

  function newTicket() {
    setTicket(dealTicket());
    setOpened(0);
    setExtraOpen(false);
    setForceOpen(false);
  }

  function moveCoin(event: React.PointerEvent<HTMLDivElement>) {
    const coin = coinRef.current;
    const stage = stageRef.current;
    if (!coin || !stage) return;
    const rect = stage.getBoundingClientRect();
    coin.style.transform = `translate(${event.clientX - rect.left}px, ${event.clientY - rect.top}px)`;
    coin.dataset.on = '';
  }

  function hideCoin() {
    const coin = coinRef.current;
    if (coin) delete coin.dataset.on;
  }

  const result = !done
    ? 'Raspe os seis campos para ver o resultado.'
    : ticket.prize
      ? `Três símbolos iguais: você ganhou ${ticket.prize}.`
      : 'Não foi dessa vez. Nenhum símbolo saiu três vezes.';

  return (
    <div className="scratch-page public-page">
      <ParallaxBackground image="/brand/stage-pattern.webp" />
      <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />

      <header className="scratch-hero">
        <span className="badge badge-muted scratch-tag">
          <Lightbulb size={16} aria-hidden="true" /> Ideia em votação
        </span>
        <h1>Raspadinha</h1>
        <p>Arraste a moeda e raspe os campos. Três símbolos iguais valem o brinde.</p>
        <p className="scratch-note">
          Protótipo para a galera escolher. A cartela é sorteada aqui no navegador, só para testar: não vale brinde e
          nada é registrado.
        </p>
      </header>

      <main className="scratch-main">
        <div className="ticket">
          <div className="ticket-head">
            <img src="/brand/occ-round.webp" alt="" width={32} height={32} />
            <span className="ticket-name">Raspadinha OCC</span>
            <span className="ticket-price">grátis</span>
            <span className="ticket-serial">{serial(ticket.id)}</span>
          </div>

          <div className="ticket-body" ref={stageRef} onPointerMove={moveCoin} onPointerLeave={hideCoin}>
            <section className="ticket-play">
              <h2 className="ticket-label">Área de raspar</h2>
              <div className="ticket-grid">
                {ticket.marks.map((mark, index) => {
                  const Icon = mark.icon;
                  return (
                    <ScratchField
                      key={`${ticket.id}-${index}`}
                      label={`Campo ${index + 1}: ${mark.name}`}
                      forceOpen={forceOpen}
                      onOpen={() => setOpened((count) => count + 1)}
                    >
                      <Icon size={30} aria-hidden="true" />
                      <em>{mark.name}</em>
                    </ScratchField>
                  );
                })}
              </div>
            </section>

            <aside className="ticket-side">
              <div className="ticket-headline">
                <strong>Raspou,</strong>
                <strong>levou</strong>
                <span>brinde na hora</span>
              </div>

              <section className="ticket-extra">
                <h2 className="ticket-label">Chance extra</h2>
                <ScratchField
                  key={`${ticket.id}-extra`}
                  circle
                  label={ticket.extra ? `Chance extra: ${ticket.extra}` : 'Chance extra: nada'}
                  forceOpen={forceOpen}
                  onOpen={() => setExtraOpen(true)}
                >
                  {ticket.extra ? <em className="ticket-extra-prize">{ticket.extra}</em> : <em>nada</em>}
                </ScratchField>
              </section>
            </aside>

            <div className="scratch-coin" ref={coinRef} aria-hidden="true">
              <img src="/brand/occ-round.webp" alt="" width={52} height={52} />
            </div>
          </div>

          <p className="ticket-rules">
            Três símbolos iguais na área de raspar indicam seu brinde. A chance extra vale sozinha, raspada ou não.
            Campos abertos: {opened} de {FIELDS}.
          </p>
        </div>

        <p className="scratch-status" aria-live="polite">
          {result}
          {extraOpen ? (ticket.extra ? ` Chance extra: ${ticket.extra}.` : ' Chance extra: nada.') : ''}
        </p>

        <div className="scratch-controls">
          <button type="button" className="btn btn-primary btn-lg" onClick={newTicket}>
            <RotateCcw size={20} aria-hidden="true" /> Outra cartela
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-lg"
            onClick={() => setForceOpen(true)}
            disabled={forceOpen || (done && extraOpen)}
          >
            <Eye size={20} aria-hidden="true" /> Revelar tudo
          </button>
        </div>
      </main>

      <IdeaNav current="scratch" />
    </div>
  );
}
