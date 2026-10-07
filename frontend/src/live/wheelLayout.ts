/** Slice colors taken from the roulette artwork (assets/roulette-reference.jpg). */
export const WHEEL_COLORS = [
  { background: '#dccdae', text: '#2e1a10' }, // cream
  { background: '#d25d0e', text: '#2e1a10' }, // orange
  { background: '#31180e', text: '#f3e7cf' }, // dark brown
  { background: '#787c4a', text: '#f6edd8' }, // sage green
  { background: '#503831', text: '#f3e7cf' }, // mid brown
] as const;

export type WheelColor = (typeof WHEEL_COLORS)[number];

export interface WheelPrize {
  id: string;
  name: string;
  remainingUnits: number;
  imageUrl: string | null;
}

export interface WheelSegment {
  key: string;
  /** What the wheel can land on: a prize id, or a slot of the participant roulette (nameSlotId). */
  targetId: string;
  label: string;
  imageUrl: string | null;
  /** Prize slices without a photo show a gift icon; name slices show only the name. */
  kind: 'prize' | 'name';
  /** Degrees, clockwise from the top (where the pointer is). */
  start: number;
  end: number;
  color: WheelColor;
}

/**
 * One slice per prize that still has units, all the same size, in the order the prizes were
 * registered. The stock is not drawn on the wheel: a prize with 4 units appears once, exactly
 * like a prize with 1. (How likely each prize is remains the server's business.)
 */
export function buildWheel(prizes: WheelPrize[]): WheelSegment[] {
  const available = prizes.filter((prize) => prize.remainingUnits > 0);
  const span = 360 / Math.max(available.length, 1);
  return available.map((prize, position) => ({
    key: prize.id,
    targetId: prize.id,
    label: prize.name,
    imageUrl: prize.imageUrl,
    kind: 'prize',
    start: position * span,
    end: (position + 1) * span,
    color: colorAt(position, available.length),
  }));
}

export const nameSlotId = (slot: number): string => `slot:${slot}`;

/** Participant roulette: one equal slice per name, in the order the server sent them. */
export function buildNameWheel(names: string[]): WheelSegment[] {
  const span = 360 / Math.max(names.length, 1);
  return names.map((name, slot) => ({
    key: nameSlotId(slot),
    targetId: nameSlotId(slot),
    label: name,
    imageUrl: null,
    kind: 'name',
    start: slot * span,
    end: (slot + 1) * span,
    color: colorAt(slot, names.length),
  }));
}

/** Cycles the palette; the last slice never repeats the color of the first one (they touch). */
function colorAt(position: number, total: number): WheelColor {
  const size = WHEEL_COLORS.length;
  let index = position % size;
  if (total > 1 && position === total - 1 && index === 0) index = (index + 2) % size;
  return WHEEL_COLORS[index]!;
}

/** FNV-1a: tiny deterministic hash so every screen picks the same landing spot for a draw. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export interface Landing {
  segmentKey: string;
  /** Wheel angle (degrees, clockwise from the top) that must stop under the pointer. */
  angle: number;
}

/** Where the wheel stops for a drawn prize (or name slot): one of its slices, not always at the exact middle. */
export function landingFor(segments: WheelSegment[], targetId: string, seed: string): Landing | null {
  const candidates = segments.filter((segment) => segment.targetId === targetId);
  if (candidates.length === 0) return null;
  const hash = hashString(seed);
  const segment = candidates[hash % candidates.length]!;
  const offset = (((hash >>> 8) % 1000) / 1000 - 0.5) * 0.6; // within the middle 60% of the slice
  return { segmentKey: segment.key, angle: segment.start + (segment.end - segment.start) * (0.5 + offset) };
}

/** Rotation (degrees) that brings `angle` under the pointer after at least `turns` full turns from `from`. */
export function rotationToLand(angle: number, from: number, turns: number): number {
  const base = from + turns * 360;
  const delta = (((-angle - base) % 360) + 360) % 360;
  return base + delta;
}

/**
 * Braking of a free-spinning wheel: it travels |v0|·t + a·t² + b·t³ degrees (t in seconds) in the
 * direction it was already turning, which starts at the current speed, stops after `duration`
 * and leaves `angle` under the pointer.
 */
export interface LandingCurve {
  from: number;
  /** Degrees per second; negative when the wheel turns counterclockwise. */
  v0: number;
  a: number;
  b: number;
  duration: number;
}

export function landingCurve(from: number, v0: number, angle: number, duration: number): LandingCurve {
  const direction = v0 < 0 ? -1 : 1;
  const speed = Math.abs(v0);
  // Distance still to travel, in the turning direction, until `angle` is under the pointer.
  const delta = (((direction * (-angle - from)) % 360) + 360) % 360;
  // Braking evenly from v0 covers v0·T/2. Any distance from v0·T/3 up to that never speeds the
  // wheel up nor turns it backwards: take the first stop past v0·T/3 (always fits when v0·T ≥ 2160°).
  const minimum = (speed * duration) / 3;
  const distance = delta + Math.max(Math.ceil((minimum - delta) / 360), 0) * 360;
  return {
    from,
    v0,
    a: ((3 * distance) / duration - 2 * speed) / duration,
    b: (speed * duration - 2 * distance) / duration ** 3,
    duration,
  };
}

export function curveAngle(curve: LandingCurve, seconds: number): number {
  const t = Math.min(Math.max(seconds, 0), curve.duration);
  const direction = curve.v0 < 0 ? -1 : 1;
  return curve.from + direction * (Math.abs(curve.v0) * t + curve.a * t * t + curve.b * t * t * t);
}

export const conicGradient = (segments: WheelSegment[]): string =>
  `conic-gradient(${segments.map((s) => `${s.color.background} ${s.start}deg ${s.end}deg`).join(', ')})`;
