import { Eye, Lightbulb, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ParallaxBackground } from '../../live/ParallaxBackground';
import { useConfetti } from '../../live/useConfetti';
import { IdeaNav } from './IdeaNav';
import './scratch.css';

/**
 * Prototype of a scratch-card draw, up for the crew to vote on: a coin follows the pointer and
 * scratching the coating uncovers the result. Everything here is mocked on the client — the prize
 * is picked in the browser, nothing is registered and no one wins anything for real. In the real
 * thing the server would draw it, like every other draw mode.
 */

const MOCK_PRIZES = ['Camiseta OCC', 'Boné OCC', 'Kit de cabelo', 'Caneca OCC', 'Cartela de adesivos'];
/** Mocked odds, generous on purpose so the prototype is fun to try out. */
const WIN_CHANCE = 0.5;
/** How much of the coating has to be gone before the card opens on its own. */
const REVEAL_AT = 0.55;
/** Radius of the scratch, in CSS pixels. */
const BRUSH = 24;

interface Ticket {
  id: number;
  prize: string | null;
}

let ticketCount = 0;

function drawTicket(): Ticket {
  ticketCount += 1;
  const prize = Math.random() < WIN_CHANCE ? MOCK_PRIZES[Math.floor(Math.random() * MOCK_PRIZES.length)] : null;
  return { id: ticketCount, prize: prize ?? null };
}

const serial = (id: number) => `OCC-${String(id).padStart(4, '0')}`;

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  return canvas.getContext('2d', { willReadFrequently: true });
}

/** The metallic coating: bronze gradient, speckles and the invitation to scratch. */
function paintCoating(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#8a7257');
  gradient.addColorStop(0.35, '#b79b78');
  gradient.addColorStop(0.5, '#d9c3a3');
  gradient.addColorStop(0.65, '#b79b78');
  gradient.addColorStop(1, '#7d6549');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(46, 36, 25, 0.16)';
  for (let i = 0; i < Math.round((width * height) / 900); i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    ctx.fillRect(x, y, Math.random() * 2 + 0.5, Math.random() * 2 + 0.5);
  }

  ctx.fillStyle = 'rgba(46, 36, 25, 0.5)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.max(14, Math.round(width / 18))}px system-ui, sans-serif`;
  ctx.fillText('RASPE AQUI', width / 2, height / 2 - 2);
  ctx.font = `500 ${Math.max(11, Math.round(width / 34))}px system-ui, sans-serif`;
  ctx.fillText('arraste a moeda', width / 2, height / 2 + Math.max(18, width / 24));
}

export function ScratchPage() {
  const [ticket, setTicket] = useState<Ticket>(drawTicket);
  const [revealed, setRevealed] = useState(false);
  const [progress, setProgress] = useState(0);
  const { canvasRef: confettiRef, celebrate } = useConfetti();

  const cardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coinRef = useRef<HTMLDivElement>(null);
  const scratching = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const strokes = useRef(0);
  const revealedRef = useRef(false);

  const reset = useCallback((next: Ticket) => {
    revealedRef.current = false;
    scratching.current = false;
    lastPoint.current = null;
    strokes.current = 0;
    setRevealed(false);
    setProgress(0);
    setTicket(next);
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const card = cardRef.current;
    if (!canvas || !card) return;
    const rect = card.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    // Setting the size also resets the transform, so the scale below never piles up.
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = context(canvas);
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.globalCompositeOperation = 'source-over';
    paintCoating(ctx, rect.width, rect.height);
  }, []);

  // A fresh ticket always gets a fresh coating.
  useEffect(() => {
    paint();
  }, [paint, ticket.id]);

  // Repainting on resize would wipe a card in progress, so only untouched ones follow the layout.
  useEffect(() => {
    const card = cardRef.current;
    if (!card || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (strokes.current === 0 && !revealedRef.current) paint();
    });
    observer.observe(card);
    return () => observer.disconnect();
  }, [paint]);

  /** Share of the coating already gone, sampled every few pixels (reading it all is expensive). */
  function scratchedAway(): number {
    const canvas = canvasRef.current;
    const ctx = canvas && context(canvas);
    if (!canvas || !ctx) return 0;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let clear = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 4 * 32) {
      total += 1;
      if ((data[i] ?? 0) < 24) clear += 1;
    }
    return total === 0 ? 0 : clear / total;
  }

  const reveal = useCallback(
    (prize: string | null) => {
      if (revealedRef.current) return;
      revealedRef.current = true;
      scratching.current = false;
      setRevealed(true);
      setProgress(1);
      if (prize) celebrate();
    },
    [celebrate],
  );

  function pointIn(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function moveCoin(event: React.PointerEvent<HTMLCanvasElement>) {
    const coin = coinRef.current;
    const card = cardRef.current;
    if (!coin || !card) return;
    const rect = card.getBoundingClientRect();
    coin.style.transform = `translate(${event.clientX - rect.left}px, ${event.clientY - rect.top}px)`;
    coin.dataset.on = '';
  }

  function scratch(from: { x: number; y: number } | null, to: { x: number; y: number }) {
    const canvas = canvasRef.current;
    const ctx = canvas && context(canvas);
    if (!ctx) return;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = BRUSH * 2;
    ctx.beginPath();
    if (from) {
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    ctx.arc(to.x, to.y, BRUSH, 0, Math.PI * 2);
    ctx.fill();
    strokes.current += 1;
    // Reading the pixels is costly: check now and then, not on every single movement.
    if (strokes.current % 6 === 0) {
      const done = scratchedAway();
      setProgress(done);
      if (done >= REVEAL_AT) reveal(ticket.prize);
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (revealedRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    scratching.current = true;
    const point = pointIn(event);
    lastPoint.current = point;
    moveCoin(event);
    scratch(null, point);
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    moveCoin(event);
    if (!scratching.current || revealedRef.current) return;
    const point = pointIn(event);
    scratch(lastPoint.current, point);
    lastPoint.current = point;
  }

  function onPointerUp() {
    if (!scratching.current) return;
    scratching.current = false;
    lastPoint.current = null;
    const done = scratchedAway();
    setProgress(done);
    if (done >= REVEAL_AT) reveal(ticket.prize);
  }

  function hideCoin() {
    const coin = coinRef.current;
    if (coin) delete coin.dataset.on;
  }

  return (
    <div className="scratch-page public-page">
      <ParallaxBackground image="/brand/stage-pattern.webp" />
      <canvas ref={confettiRef} className="confetti-canvas" aria-hidden="true" />

      <header className="scratch-hero">
        <span className="badge badge-muted scratch-tag">
          <Lightbulb size={16} aria-hidden="true" /> Ideia em votação
        </span>
        <h1>Raspadinha</h1>
        <p>Arraste a moeda sobre a cartela. O que estiver embaixo é o que você levou.</p>
        <p className="scratch-note">
          Protótipo para a galera escolher. O resultado é sorteado aqui no navegador, só para testar: não vale brinde e
          nada é registrado.
        </p>
      </header>

      <main className="scratch-main">
        <div className="scratch-ticket">
          <div className="scratch-ticket-top">
            <img src="/brand/occ-round.webp" alt="" width={34} height={34} />
            <span>Raspadinha OCC</span>
            <span className="scratch-serial">{serial(ticket.id)}</span>
          </div>

          <div className="scratch-card" ref={cardRef}>
            <div className={`scratch-result ${revealed ? 'is-open' : ''}`}>
              {ticket.prize ? (
                <>
                  <span className="scratch-result-label">Você ganhou</span>
                  <strong className="scratch-result-prize">{ticket.prize}</strong>
                </>
              ) : (
                <>
                  <span className="scratch-result-label">Não foi dessa vez</span>
                  <strong className="scratch-result-prize scratch-result-empty">Fica para a próxima</strong>
                </>
              )}
            </div>

            <canvas
              ref={canvasRef}
              className={`scratch-coating ${revealed ? 'is-revealed' : ''}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerLeave={hideCoin}
              onPointerEnter={moveCoin}
              aria-label="Área para raspar. Use o botão Revelar se preferir abrir sem raspar."
              role="img"
            />
            <div className="scratch-coin" ref={coinRef} aria-hidden="true">
              <img src="/brand/occ-round.webp" alt="" width={56} height={56} />
            </div>
          </div>

          <div className="scratch-ticket-bottom">
            <div className="scratch-track" aria-hidden="true">
              <div className="scratch-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <span className="scratch-percent">{revealed ? 'Aberta' : `${Math.round(progress * 100)}% raspada`}</span>
          </div>
        </div>

        <p className="scratch-status" aria-live="polite">
          {revealed
            ? ticket.prize
              ? `Você ganhou: ${ticket.prize}.`
              : 'Não foi dessa vez. Fica para a próxima.'
            : 'Raspe a cartela para ver o resultado.'}
        </p>

        <div className="scratch-controls">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => reset(drawTicket())}>
            <RotateCcw size={20} aria-hidden="true" /> Raspar outra
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-lg"
            onClick={() => reveal(ticket.prize)}
            disabled={revealed}
          >
            <Eye size={20} aria-hidden="true" /> Revelar sem raspar
          </button>
        </div>
      </main>

      <IdeaNav current="scratch" />
    </div>
  );
}
