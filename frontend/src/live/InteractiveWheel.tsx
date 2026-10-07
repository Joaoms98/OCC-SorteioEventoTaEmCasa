import { useEffect, useImperativeHandle, useMemo, useRef, useState, type PointerEvent, type Ref } from 'react';
import { angleDelta, BUTTON_SPIN_SPEED, flickVelocity, pointerAngle, spinFromFlick, type DragSample, type Spin } from './spinGesture';
import { WheelFace } from './WheelFace';
import { buildWheel, curveAngle, landingCurve, landingFor, rotationToLand, type LandingCurve, type WheelPrize } from './wheelLayout';

const IDLE_DEGREES_PER_SECOND = 8;
/** Samples kept while dragging: enough to measure the throw, without growing forever. */
const SAMPLE_WINDOW_MS = 250;

export type WheelPhase = 'ready' | 'dragging' | 'spinning' | 'landed';

type Motion =
  | { kind: 'idle' }
  | { kind: 'held' }
  | { kind: 'spin'; curve: LandingCurve; startedAt: number }
  | { kind: 'landed' };

export interface InteractiveWheelHandle {
  /** Spins without a gesture (button, keyboard). */
  spin(): void;
}

interface InteractiveWheelProps {
  /** Prizes and units as they were before this spin (the won prize is among them). */
  prizes: WheelPrize[];
  /** The prize already drawn by the server: wherever the wheel is thrown, it stops there. */
  prizeId: string;
  /** Picks the same stopping point every time for the same draw. */
  seed: string;
  /** Already spun (e.g. the page was reopened): show the wheel stopped on the prize. */
  landed: boolean;
  onPhaseChange(phase: WheelPhase): void;
  /** The wheel was moved but not thrown hard enough to spin. */
  onWeakThrow(): void;
  ref?: Ref<InteractiveWheelHandle>;
}

/**
 * Prize roulette the visitor spins by hand: drag it with the mouse or a finger and let go. The
 * throw sets direction, speed and duration; the stopping point is the prize the server drew.
 */
export function InteractiveWheel({ prizes, prizeId, seed, landed, onPhaseChange, onWeakThrow, ref }: InteractiveWheelProps) {
  const discRef = useRef<HTMLDivElement>(null);
  const angle = useRef(0);
  const motion = useRef<Motion>({ kind: landed ? 'landed' : 'idle' });
  const drag = useRef<{ pointerId: number; lastPointerAngle: number; samples: DragSample[] } | null>(null);
  const [phase, setPhase] = useState<WheelPhase>(landed ? 'landed' : 'ready');

  const segments = useMemo(() => buildWheel(prizes), [prizes]);
  const landing = useMemo(() => landingFor(segments, prizeId, seed), [segments, prizeId, seed]);

  const changePhase = (next: WheelPhase) => {
    setPhase(next);
    onPhaseChange(next);
  };
  // Callbacks used by the animation loop, kept fresh without restarting it.
  const changePhaseRef = useRef(changePhase);
  changePhaseRef.current = changePhase;

  // Reopened after the spin: the wheel is already resting on the prize.
  useEffect(() => {
    if (landed && landing) {
      angle.current = rotationToLand(landing.angle, 0, 0);
      motion.current = { kind: 'landed' };
    }
  }, [landed, landing]);

  // Animation loop: writes the rotation straight to the DOM (no React render per frame).
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const state = motion.current;
      if (state.kind === 'idle' && !reduceMotion) {
        angle.current += IDLE_DEGREES_PER_SECOND * dt;
      } else if (state.kind === 'spin') {
        const elapsed = (now - state.startedAt) / 1000;
        const done = elapsed >= state.curve.duration;
        angle.current = reduceMotion && !done ? state.curve.from : curveAngle(state.curve, elapsed);
        if (done) {
          motion.current = { kind: 'landed' };
          changePhaseRef.current('landed');
        }
      }
      if (discRef.current) discRef.current.style.transform = `rotate(${angle.current}deg)`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  function startSpin({ velocity, seconds }: Spin) {
    if (!landing || motion.current.kind === 'spin' || motion.current.kind === 'landed') return;
    motion.current = {
      kind: 'spin',
      curve: landingCurve(angle.current, velocity, landing.angle, seconds),
      startedAt: performance.now(),
    };
    changePhase('spinning');
  }

  useImperativeHandle(ref, () => ({ spin: () => startSpin(spinFromFlick(BUTTON_SPIN_SPEED)!) }));

  const angleOf = (event: PointerEvent<HTMLDivElement>): number => {
    const box = event.currentTarget.getBoundingClientRect();
    return pointerAngle(box.left + box.width / 2, box.top + box.height / 2, event.clientX, event.clientY);
  };

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (motion.current.kind === 'spin' || motion.current.kind === 'landed' || drag.current) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      lastPointerAngle: angleOf(event),
      samples: [{ time: performance.now(), rotation: angle.current }],
    };
    motion.current = { kind: 'held' };
    changePhase('dragging');
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const pointer = angleOf(event);
    angle.current += angleDelta(current.lastPointerAngle, pointer);
    current.lastPointerAngle = pointer;
    const now = performance.now();
    current.samples.push({ time: now, rotation: angle.current });
    while (current.samples.length > 2 && now - current.samples[0]!.time > SAMPLE_WINDOW_MS) current.samples.shift();
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    const spin = spinFromFlick(flickVelocity(current.samples, performance.now()));
    if (spin) return startSpin(spin);
    motion.current = { kind: 'idle' };
    changePhase('ready');
    onWeakThrow();
  }

  const description =
    phase === 'landed'
      ? `Roleta de brindes parada em ${prizes.find((prize) => prize.id === prizeId)?.name ?? 'seu brinde'}`
      : `Roleta de brindes: ${[...new Set(segments.map((segment) => segment.label))].join(', ')}. Arraste para girar.`;

  return (
    <WheelFace
      segments={segments}
      highlightedKey={phase === 'landed' ? (landing?.segmentKey ?? null) : null}
      spinning={phase === 'spinning'}
      description={description}
      discRef={discRef}
      className={`wheel-interactive wheel-${phase}`}
      rimProps={{
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerEnd,
        onPointerCancel: handlePointerEnd,
      }}
    />
  );
}
