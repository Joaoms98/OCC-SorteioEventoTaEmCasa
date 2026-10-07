import { describe, expect, it } from 'vitest';
import {
  buildNameWheel,
  buildWheel,
  curveAngle,
  landingCurve,
  landingFor,
  nameSlotId,
  rotationToLand,
  type WheelPrize,
} from '../wheelLayout';

const prize = (id: string, remainingUnits: number): WheelPrize => ({ id, name: id, remainingUnits, imageUrl: null });

describe('buildWheel', () => {
  it('shows each prize that still has units once, in the order they were registered', () => {
    const segments = buildWheel([prize('kit', 3), prize('mug', 1), prize('none', 0), prize('cap', 4)]);
    expect(segments.map((s) => s.targetId)).toEqual(['kit', 'mug', 'cap']);
    expect(segments.map((s) => [s.start, s.end])).toEqual([
      [0, 120],
      [120, 240],
      [240, 360],
    ]);
  });

  it('does not draw the stock: slices are the same size whatever the units left', () => {
    const segments = buildWheel([prize('big', 90), prize('small', 1)]);
    expect(segments).toHaveLength(2);
    expect(segments.every((s) => s.end - s.start === 180)).toBe(true);
    // The wheel only changes when a prize runs out.
    expect(buildWheel([prize('big', 89), prize('small', 1)]).map((s) => [s.targetId, s.start, s.end])).toEqual(
      segments.map((s) => [s.targetId, s.start, s.end]),
    );
    expect(buildWheel([prize('big', 89), prize('small', 0)]).map((s) => s.targetId)).toEqual(['big']);
  });

  it('a single prize takes the whole wheel', () => {
    const [only, ...rest] = buildWheel([prize('kit', 50)]);
    expect(rest).toEqual([]);
    expect([only!.start, only!.end]).toEqual([0, 360]);
  });

  it('never paints two touching slices with the same color', () => {
    for (const units of [2, 5, 6, 11, 16]) {
      const segments = buildWheel(Array.from({ length: units }, (_, i) => prize(`p${i}`, 1 + (i % 4))));
      segments.forEach((segment, i) => {
        const next = segments[(i + 1) % segments.length]!;
        expect(segment.color.background).not.toBe(next.color.background);
      });
    }
  });

  it('is empty when nothing is left to draw', () => {
    expect(buildWheel([prize('kit', 0)])).toEqual([]);
  });
});

describe('landing', () => {
  const segments = buildWheel([prize('kit', 3), prize('mug', 1)]);

  it('lands inside a slice of the drawn prize, the same way on every screen', () => {
    const landing = landingFor(segments, 'mug', 'draw-123')!;
    const slice = segments.find((s) => s.key === landing.segmentKey)!;
    expect(slice.targetId).toBe('mug');
    expect(landing.angle).toBeGreaterThan(slice.start);
    expect(landing.angle).toBeLessThan(slice.end);
    expect(landingFor(segments, 'mug', 'draw-123')).toEqual(landing);
  });

  it('turns forward and stops with the landing angle under the pointer', () => {
    const rotation = rotationToLand(135, 1000, 5);
    expect(rotation).toBeGreaterThanOrEqual(1000 + 5 * 360);
    expect((((rotation + 135) % 360) + 360) % 360).toBeCloseTo(0);
  });

  it('returns null for prizes that are not on the wheel', () => {
    expect(landingFor(segments, 'gone', 'draw')).toBeNull();
  });
});

describe('participant roulette', () => {
  it('gives every name an equal slice, in the order sent by the server', () => {
    const segments = buildNameWheel(['Ana L.', 'Bruno S.', 'Carla D.', 'Davi M.']);
    expect(segments.map((s) => s.label)).toEqual(['Ana L.', 'Bruno S.', 'Carla D.', 'Davi M.']);
    expect(segments.map((s) => [s.start, s.end])).toEqual([
      [0, 90],
      [90, 180],
      [180, 270],
      [270, 360],
    ]);
    expect(segments.every((s) => s.kind === 'name' && s.imageUrl === null)).toBe(true);
  });

  it('lands inside the slot of the winner', () => {
    const segments = buildNameWheel(['Ana L.', 'Bruno S.', 'Carla D.']);
    const landing = landingFor(segments, nameSlotId(2), 'draw-9')!;
    expect(landing.segmentKey).toBe(nameSlotId(2));
    expect(landing.angle).toBeGreaterThan(240);
    expect(landing.angle).toBeLessThan(360);
  });
});

describe('landing curve', () => {
  const v0 = 900;
  const duration = 3;
  const curve = landingCurve(1234, v0, 75, duration);
  const speedAt = (t: number) => (curveAngle(curve, t + 0.001) - curveAngle(curve, t)) / 0.001;

  it('starts at the current angle and speed and stops with the target under the pointer', () => {
    expect(curveAngle(curve, 0)).toBeCloseTo(1234);
    expect(speedAt(0)).toBeCloseTo(v0, 0);
    const final = curveAngle(curve, duration);
    expect((((final + 75) % 360) + 360) % 360).toBeCloseTo(0);
    expect(curveAngle(curve, duration + 5)).toBe(final);
  });

  it('only slows down: never speeds up nor turns backwards', () => {
    for (let t = 0; t < duration - 0.01; t += 0.05) {
      expect(speedAt(t + 0.05)).toBeLessThanOrEqual(speedAt(t) + 1e-6);
      expect(speedAt(t)).toBeGreaterThanOrEqual(0);
    }
  });

  it('brakes smoothly from rest too (reduced motion, late landing)', () => {
    const fromRest = landingCurve(0, 0, 90, 1);
    expect((((curveAngle(fromRest, 1) + 90) % 360) + 360) % 360).toBeCloseTo(0);
  });
});
