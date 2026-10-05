import { Gift } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { assetUrl } from '../api/httpClient';
import type { DrawMode } from '../types/api';
import type { LivePrize, StageDraw } from './types';
import {
  buildNameWheel,
  buildWheel,
  conicGradient,
  curveAngle,
  landingCurve,
  landingFor,
  nameSlotId,
  rotationToLand,
  type Landing,
  type LandingCurve,
  type WheelSegment,
} from './wheelLayout';
import './wheel.css';

const IDLE_DEGREES_PER_SECOND = 6;
/** Participant roulette: free spin until the server tells where it stops. */
const CRUISE_DEGREES_PER_SECOND = 900;
const SPIN_UP_MS = 900;
/** A landing announced late (slow network) still brakes visibly instead of jumping. */
const MIN_LANDING_MS = 800;
const IDLE_NAMES = 12;
const MIN_LABEL_SPAN = 13;
const MIN_ICON_SPAN = 8;

type Motion =
  | { kind: 'idle' }
  /** Prize roulette: the prize is known from the start, one smooth spin until the reveal. */
  | { kind: 'spin'; drawId: string; from: number; to: number; startedAt: number; endsAt: number }
  /** Participant roulette: spins freely while the winner's slot is a secret. */
  | { kind: 'cruise'; drawId: string; fromSpeed: number; startedAt: number }
  | { kind: 'land'; drawId: string; curve: LandingCurve; startedAt: number }
  | { kind: 'landed'; drawId: string };

interface LandingTarget extends Landing {
  drawId: string;
  /** Local timestamps (ms): start braking at landingAt, stop at revealAt. */
  landingAt: number;
  revealAt: number;
}

const easeOutQuart = (t: number) => 1 - (1 - t) ** 4;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

interface RouletteWheelProps {
  mode: DrawMode;
  prizes: LivePrize[];
  /** Names on the idle participant roulette (random contenders, abbreviated). */
  idleNames: string[];
  current: StageDraw | null;
}

/**
 * Roulette drawn in CSS (conic-gradient), modeled after assets/roulette-reference.jpg. It spins the
 * prizes or the participants' names. The server picks prize and winner; the wheel only animates
 * towards them and stops exactly when the winner is revealed, the same way on every screen.
 */
export function RouletteWheel({ mode, prizes, idleNames, current }: RouletteWheelProps) {
  const discRef = useRef<HTMLDivElement>(null);
  const angle = useRef(0);
  const speed = useRef(0);
  const motion = useRef<Motion>({ kind: 'idle' });
  const target = useRef<LandingTarget | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [landedKey, setLandedKey] = useState<string | null>(null);

  const idleSegments = useMemo(
    () => (mode === 'PARTICIPANTS' ? buildNameWheel(idleNames.slice(0, IDLE_NAMES)) : buildWheel(prizes)),
    [mode, idleNames, prizes],
  );

  // The layout is frozen while a draw is on stage, so live updates never move the slices under a
  // spinning (or stopped) wheel. It is rebuilt when the next draw starts.
  const frozen = useRef<{ key: string; segments: WheelSegment[] } | null>(null);
  const frozenKey = current ? `${current.drawId}:${current.wheel ? 'names' : mode}` : null;
  if (!current || !frozenKey) frozen.current = null;
  else if (frozen.current?.key !== frozenKey) {
    frozen.current = {
      key: frozenKey,
      segments: current.wheel
        ? buildNameWheel(current.wheel.names)
        : mode === 'PARTICIPANTS'
          ? idleSegments
          : buildWheel(wheelBeforeDraw(prizes, current)),
    };
  }
  const segments = frozen.current?.segments ?? idleSegments;
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  // Animation loop: writes the rotation straight to the DOM (no React render per frame).
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const state = motion.current;
      let nextSpeed = 0;
      if (state.kind === 'idle' && !reduceMotion) {
        nextSpeed = IDLE_DEGREES_PER_SECOND;
        angle.current += nextSpeed * dt;
      } else if (state.kind === 'spin') {
        const progress = Math.min((now - state.startedAt) / Math.max(state.endsAt - state.startedAt, 1), 1);
        angle.current = reduceMotion && progress < 1 ? state.from : state.from + (state.to - state.from) * easeOutQuart(progress);
        if (progress >= 1) {
          motion.current = { kind: 'landed', drawId: state.drawId };
          setSpinning(false);
        }
      } else if (state.kind === 'cruise') {
        const progress = Math.min((now - state.startedAt) / SPIN_UP_MS, 1);
        nextSpeed = reduceMotion ? 0 : state.fromSpeed + (CRUISE_DEGREES_PER_SECOND - state.fromSpeed) * easeOutCubic(progress);
        angle.current += nextSpeed * dt;
        const landing = target.current;
        if (landing?.drawId === state.drawId && Date.now() >= landing.landingAt) {
          const duration = Math.max(landing.revealAt - Date.now(), MIN_LANDING_MS) / 1000;
          motion.current = {
            kind: 'land',
            drawId: state.drawId,
            curve: landingCurve(angle.current, nextSpeed, landing.angle, duration),
            startedAt: now,
          };
        }
      } else if (state.kind === 'land') {
        const elapsed = (now - state.startedAt) / 1000;
        const done = elapsed >= state.curve.duration;
        angle.current = reduceMotion && !done ? state.curve.from : curveAngle(state.curve, elapsed);
        if (done) {
          motion.current = { kind: 'landed', drawId: state.drawId };
          setSpinning(false);
        }
      }
      speed.current = nextSpeed;
      if (discRef.current) discRef.current.style.transform = `rotate(${angle.current}deg)`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // React to the draw on stage: spin towards its result, or jump there when joining late.
  useEffect(() => {
    if (!current) {
      motion.current = { kind: 'idle' };
      target.current = null;
      setSpinning(false);
      setLandedKey(null);
      return;
    }
    const landing = current.wheel
      ? current.wheel.slot === null
        ? null
        : landingFor(segmentsRef.current, nameSlotId(current.wheel.slot), current.drawId)
      : mode === 'PARTICIPANTS'
        ? null // a draw without its wheel (joined after it): nothing to land on
        : landingFor(segmentsRef.current, current.prize.id, current.drawId);
    setLandedKey(landing?.segmentKey ?? null);
    target.current = landing
      ? { ...landing, drawId: current.drawId, landingAt: current.landingAt, revealAt: current.revealAt }
      : null;

    const state = motion.current;
    if (state.kind !== 'idle' && state.drawId === current.drawId) return; // already on it (the loop lands it)

    const remainingMs = current.revealAt - Date.now();
    const now = performance.now();
    if (current.phase === 'drawing' && remainingMs > 400 && current.wheel) {
      motion.current = { kind: 'cruise', drawId: current.drawId, fromSpeed: speed.current, startedAt: now };
      setSpinning(true);
    } else if (current.phase === 'drawing' && remainingMs > 400 && landing) {
      const turns = Math.min(Math.max(Math.round(remainingMs / 1000) + 2, 3), 10);
      motion.current = {
        kind: 'spin',
        drawId: current.drawId,
        from: angle.current,
        to: rotationToLand(landing.angle, angle.current, turns),
        startedAt: now,
        endsAt: now + remainingMs,
      };
      setSpinning(true);
    } else {
      if (landing) angle.current = rotationToLand(landing.angle, angle.current, 0);
      motion.current = { kind: 'landed', drawId: current.drawId };
      setSpinning(false);
    }
  }, [current, mode]);

  const showResult = !spinning && current !== null && current.phase !== 'drawing';
  const wheelBackground = segments.length > 0 ? conicGradient(segments) : undefined;

  return (
    <div className={`wheel ${spinning ? 'wheel-spinning' : ''}`} role="img" aria-label={wheelDescription(segments, mode)}>
      <div className="wheel-pointer" aria-hidden="true" />
      <div className="wheel-rim">
        <div ref={discRef} className={`wheel-disc ${segments.length === 0 ? 'wheel-disc-empty' : ''}`} style={{ background: wheelBackground }}>
          {segments.map((segment) => (
            <WheelLabel key={segment.key} segment={segment} highlighted={showResult && landedKey === segment.key} />
          ))}
        </div>
        <div className="wheel-hub" aria-hidden="true" />
      </div>
      <div className="wheel-stand" aria-hidden="true">
        <span className="wheel-stand-neck" />
        <span className="wheel-stand-base" />
      </div>
    </div>
  );
}

function WheelLabel({ segment, highlighted }: { segment: WheelSegment; highlighted: boolean }) {
  const span = segment.end - segment.start;
  const middle = segment.start + span / 2;
  // Labels on the left half are turned around so they never read upside down.
  const flipped = middle > 180;
  return (
    <>
      {highlighted && (
        <div
          className="wheel-highlight"
          style={{
            background: `conic-gradient(transparent ${segment.start}deg, rgb(251 248 204 / 38%) ${segment.start}deg ${segment.end}deg, transparent ${segment.end}deg)`,
          }}
        />
      )}
      <div className="wheel-label" style={{ transform: `rotate(${middle - 90}deg)` }}>
        <div
          className={`wheel-label-content ${flipped ? 'wheel-label-flipped' : ''}`}
          style={{ color: segment.color.text, fontSize: `calc(var(--wheel-size) * ${labelScale(span)})` }}
        >
          {span >= MIN_LABEL_SPAN && <span className="wheel-label-text">{segment.label}</span>}
          {segment.kind === 'prize' &&
            span >= MIN_ICON_SPAN &&
            (segment.imageUrl ? (
              <img className="wheel-label-image" src={assetUrl(segment.imageUrl)} alt="" />
            ) : (
              <Gift className="wheel-label-icon" aria-hidden="true" />
            ))}
        </div>
      </div>
    </>
  );
}

function wheelDescription(segments: WheelSegment[], mode: DrawMode): string {
  const labels = [...new Set(segments.map((segment) => segment.label))];
  const names = segments.length > 0 ? segments[0]!.kind === 'name' : mode === 'PARTICIPANTS';
  if (labels.length === 0) return names ? 'Roleta de participantes sem participantes' : 'Roleta de brindes sem brindes disponíveis';
  return `${names ? 'Roleta de participantes' : 'Roleta de brindes'}: ${labels.join(', ')}`;
}

/**
 * During the spin the public board already shows the counts from before the draw. Joining after
 * the reveal, the drawn unit is gone: put it back so the wheel is the one that actually spun.
 */
function wheelBeforeDraw(prizes: LivePrize[], current: StageDraw) {
  if (current.phase === 'drawing') return prizes;
  const known = prizes.some((prize) => prize.id === current.prize.id);
  const restored = prizes.map((prize) =>
    prize.id === current.prize.id ? { ...prize, remainingUnits: prize.remainingUnits + 1 } : prize,
  );
  return known ? restored : [...restored, { ...current.prize, quantity: 1, remainingUnits: 1, imageUrl: null }];
}

/** Font size (fraction of the wheel size): smaller on narrow slices so neighbors do not collide. */
const labelScale = (span: number): number => Math.min(0.036, Math.max(0.024, span * 0.0014));
