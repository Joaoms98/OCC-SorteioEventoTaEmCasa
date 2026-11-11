import { Eye, Lightbulb, RotateCcw } from 'lucide-react';
import { useRef, useState } from 'react';
import { ParallaxBackground } from '../../live/ParallaxBackground';
import { useConfetti } from '../../live/useConfetti';
import { IdeaNav } from './IdeaNav';
import { ScratchField } from './ScratchField';
import { mockPrize } from './ideas';
import './scratch.css';

/**
 * Prototype of a scratch-card draw, up for the crew to vote on: a printed ticket with one covered
 * field. A coin follows the pointer, rubs the coating off and what is underneath is what you took.
 *
 * Everything is mocked in the browser — the ticket is dealt on the client, nothing is registered
 * and nobody wins anything. In the real draw the server would decide, like in every other mode.
 */

/** Mocked odds, generous on purpose so the prototype is fun to try out. */
const WIN_CHANCE = 0.5;

interface Ticket {
  id: number;
  prize: string | null;
}

let ticketCount = 0;

function dealTicket(): Ticket {
  ticketCount += 1;
  return { id: ticketCount, prize: Math.random() < WIN_CHANCE ? mockPrize() : null };
}

const serial = (id: number) => `OCC-${String(id).padStart(4, '0')}`;

export function ScratchPage() {
  const [ticket, setTicket] = useState<Ticket>(dealTicket);
  const [open, setOpen] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  const { canvasRef, celebrate } = useConfetti();

  const stageRef = useRef<HTMLDivElement>(null);
  const coinRef = useRef<HTMLDivElement>(null);

  function newTicket() {
    setTicket(dealTicket());
    setOpen(false);
    setForceOpen(false);
  }

  function opened() {
    setOpen(true);
    if (ticket.prize) celebrate();
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

  return (
    <div className="scratch-page public-page">
      <ParallaxBackground image="/brand/stage-pattern.webp" />
      <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />

      <header className="scratch-hero">
        <span className="badge badge-muted scratch-tag">
          <Lightbulb size={16} aria-hidden="true" /> Ideia em votação
        </span>
        <h1>Raspadinha</h1>
        <p>Arraste a moeda sobre a cartela. O que estiver embaixo é o que você levou.</p>
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
              <ScratchField
                key={ticket.id}
                label={ticket.prize ? `Você ganhou ${ticket.prize}` : 'Não foi dessa vez'}
                forceOpen={forceOpen}
                onOpen={opened}
              >
                {ticket.prize ? (
                  <>
                    <span className="field-label">Você ganhou</span>
                    <strong className="field-prize">{ticket.prize}</strong>
                  </>
                ) : (
                  <>
                    <span className="field-label">Não foi dessa vez</span>
                    <strong className="field-prize field-prize-empty">Fica para a próxima</strong>
                  </>
                )}
              </ScratchField>
            </section>

            <aside className="ticket-side">
              <div className="ticket-headline">
                <strong>Raspou,</strong>
                <strong>levou</strong>
                <span>brinde na hora</span>
              </div>
            </aside>

            <div className="scratch-coin" ref={coinRef} aria-hidden="true">
              <img src="/brand/occ-round.webp" alt="" width={52} height={52} />
            </div>
          </div>

          <p className="ticket-rules">
            Raspe a área coberta para ver o resultado da cartela. Cada cartela vale uma raspada; se não vier brinde,
            pegue outra.
          </p>
        </div>

        <p className="scratch-status" aria-live="polite">
          {open
            ? ticket.prize
              ? `Você ganhou: ${ticket.prize}.`
              : 'Não foi dessa vez. Fica para a próxima.'
            : 'Raspe a cartela para ver o resultado.'}
        </p>

        <div className="scratch-controls">
          <button type="button" className="btn btn-primary btn-lg" onClick={newTicket}>
            <RotateCcw size={20} aria-hidden="true" /> Outra cartela
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-lg"
            onClick={() => setForceOpen(true)}
            disabled={open}
          >
            <Eye size={20} aria-hidden="true" /> Revelar sem raspar
          </button>
        </div>
      </main>

      <IdeaNav current="scratch" />
    </div>
  );
}
