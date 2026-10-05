import confetti from 'canvas-confetti';
import { useCallback, useEffect, useRef } from 'react';

const BRAND_COLORS = ['#e8611f', '#fbf8cc', '#2e9b2c', '#9ed6f2', '#f9a26c'];

/** Confetti on our own canvas, without the Web Worker (blob: workers are blocked by the CSP). */
export function useConfetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fireRef = useRef<confetti.CreateTypes | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const fire = confetti.create(canvasRef.current, { resize: true, useWorker: false });
    fireRef.current = fire;
    return () => {
      fire.reset();
      fireRef.current = null;
    };
  }, []);

  const celebrate = useCallback(() => {
    const fire = fireRef.current;
    if (!fire || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = BRAND_COLORS;
    // Phones get fewer particles: same effect on a small screen, less work for the CPU.
    const scale = window.innerWidth < 700 ? 0.55 : 1;
    const count = (particles: number) => Math.round(particles * scale);
    void fire({ particleCount: count(160), spread: 100, origin: { y: 0.6 }, colors });
    setTimeout(() => void fire({ particleCount: count(90), angle: 60, spread: 70, origin: { x: 0 }, colors }), 250);
    setTimeout(() => void fire({ particleCount: count(90), angle: 120, spread: 70, origin: { x: 1 }, colors }), 400);
  }, []);

  return { canvasRef, celebrate };
}
