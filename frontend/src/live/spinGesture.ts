/** A point of the drag: when it happened and how much the wheel had turned by then (degrees). */
export interface DragSample {
  time: number;
  rotation: number;
}

/** Slower than this (degrees per second) and the wheel was only nudged, not spun. */
export const MIN_FLICK_SPEED = 180;
const MIN_SPIN_SPEED = 600;
const MAX_SPIN_SPEED = 1600;
const MIN_SPIN_SECONDS = 3.6;
const MAX_SPIN_SECONDS = 6.5;
/** Only the end of the drag tells how hard the wheel was thrown. */
const FLICK_WINDOW_MS = 120;

/** Speed of the spin started by the button, for whoever cannot (or does not want to) drag. */
export const BUTTON_SPIN_SPEED = 1000;

/** Direction of a pointer seen from the wheel centre, in degrees (clockwise, on the screen). */
export const pointerAngle = (centerX: number, centerY: number, x: number, y: number): number =>
  (Math.atan2(y - centerY, x - centerX) * 180) / Math.PI;

/** Shortest way from one angle to another, in degrees: between -180 and 180. */
export function angleDelta(from: number, to: number): number {
  const delta = (to - from) % 360;
  return delta > 180 ? delta - 360 : delta <= -180 ? delta + 360 : delta;
}

/** How fast the wheel was turning when it was let go (degrees per second, signed). */
export function flickVelocity(samples: DragSample[], releasedAt: number): number {
  const recent = samples.filter((sample) => releasedAt - sample.time <= FLICK_WINDOW_MS);
  const first = recent[0];
  const last = recent.at(-1);
  if (!first || !last || last.time - first.time < 16) return 0;
  return ((last.rotation - first.rotation) / (last.time - first.time)) * 1000;
}

export interface Spin {
  /** Degrees per second; negative turns the wheel counterclockwise. */
  velocity: number;
  seconds: number;
}

/**
 * Turns the release of the wheel into a spin, or null when it was too weak to count. Harder
 * throws spin faster and longer, within limits that keep the wheel readable while it brakes.
 */
export function spinFromFlick(velocity: number): Spin | null {
  if (Math.abs(velocity) < MIN_FLICK_SPEED) return null;
  const speed = Math.min(Math.max(Math.abs(velocity), MIN_SPIN_SPEED), MAX_SPIN_SPEED);
  const seconds = Math.min(Math.max(speed / 240, MIN_SPIN_SECONDS), MAX_SPIN_SECONDS);
  return { velocity: velocity < 0 ? -speed : speed, seconds };
}
