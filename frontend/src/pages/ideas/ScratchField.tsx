import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * One scratchable field of the ticket: a canvas coating that is rubbed off with the pointer and
 * clears itself once most of it is gone, the way a real scratch card opens one value at a time.
 */

/** Share of the coating that has to go before the field opens on its own. */
const OPEN_AT = 0.45;
/** Scratch radius, in CSS pixels: wide enough for the field without needing dozens of passes. */
const BRUSH_MIN = 14;
const BRUSH_MAX = 28;

interface Point {
  x: number;
  y: number;
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  return canvas.getContext('2d', { willReadFrequently: true });
}

function paintCoating(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#8a7257');
  gradient.addColorStop(0.4, '#c3a885');
  gradient.addColorStop(0.55, '#ddc8a8');
  gradient.addColorStop(1, '#7d6549');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(46, 36, 25, 0.14)';
  for (let i = 0; i < Math.round((width * height) / 500); i++) {
    ctx.fillRect(Math.random() * width, Math.random() * height, Math.random() * 2 + 0.4, Math.random() * 2 + 0.4);
  }
}

export function ScratchField({
  children,
  label,
  forceOpen = false,
  onOpen,
}: {
  children: ReactNode;
  label: string;
  forceOpen?: boolean;
  onOpen: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratching = useRef(false);
  const last = useRef<Point | null>(null);
  const strokes = useRef(0);
  const opened = useRef(false);
  const brush = useRef(BRUSH_MIN);
  const [open, setOpen] = useState(false);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = context(canvas);
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.globalCompositeOperation = 'source-over';
    brush.current = Math.round(Math.min(BRUSH_MAX, Math.max(BRUSH_MIN, rect.width / 9)));
    paintCoating(ctx, rect.width, rect.height);
  }, []);

  useEffect(() => {
    paint();
  }, [paint]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (strokes.current === 0 && !opened.current) paint();
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [paint]);

  const reveal = useCallback(() => {
    if (opened.current) return;
    opened.current = true;
    scratching.current = false;
    setOpen(true);
    onOpen();
  }, [onOpen]);

  useEffect(() => {
    if (forceOpen) reveal();
  }, [forceOpen, reveal]);

  function clearedShare(): number {
    const canvas = canvasRef.current;
    const ctx = canvas && context(canvas);
    if (!canvas || !ctx) return 0;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let clear = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 4 * 16) {
      total += 1;
      if ((data[i] ?? 0) < 24) clear += 1;
    }
    return total === 0 ? 0 : clear / total;
  }

  function at(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function rub(from: Point | null, to: Point) {
    const canvas = canvasRef.current;
    const ctx = canvas && context(canvas);
    if (!ctx) return;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brush.current * 2;
    ctx.beginPath();
    if (from) {
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    ctx.arc(to.x, to.y, brush.current, 0, Math.PI * 2);
    ctx.fill();
    strokes.current += 1;
    if (strokes.current % 4 === 0 && clearedShare() >= OPEN_AT) reveal();
  }

  function onDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (opened.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    scratching.current = true;
    const point = at(event);
    last.current = point;
    rub(null, point);
  }

  function onMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!scratching.current || opened.current) return;
    const point = at(event);
    rub(last.current, point);
    last.current = point;
  }

  function onUp() {
    if (!scratching.current) return;
    scratching.current = false;
    last.current = null;
    if (clearedShare() >= OPEN_AT) reveal();
  }

  return (
    <div ref={wrapRef} className={`field ${open ? 'is-open' : ''}`}>
      <div className="field-value">{children}</div>
      <canvas
        ref={canvasRef}
        className="field-coating"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        role="img"
        aria-label={open ? label : `${label}: ainda coberto`}
      />
    </div>
  );
}
