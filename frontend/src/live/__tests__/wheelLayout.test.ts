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
  it('gives one slice per unit and interleaves repeated prizes', () => {
    const segments = buildWheel([prize('kit', 3), prize('mug', 1), prize('none', 0)]);
    expect(segments.map((s) => s.targetId)).toEqual(['kit', 'mug', 'kit', 'kit']);
    expect(segments.every((s) => s.end - s.start === 90)).toBe(true);
    expect(segments.at(-1)!.end).toBeCloseTo(360);
  });

  it('keeps each prize angle proportional to its odds when units do not fit', () => {
    const segments = buildWheel([prize('big', 90), prize('small', 10)]);
    const share = (id: string) =>
      segments.filter((s) => s.targetId === id).reduce((sum, s) => sum + s.end - s.start, 0);
    expect(segments.length).toBeLessThanOrEqual(17);
    expect(share('big')).toBeCloseTo(324);
    expect(share('small')).toBeCloseTo(36);
  });

  it('never paints two touching slices with the same color', () => {
    for (const units of [2, 5, 6, 11, 16]) {
      const segments = buildWheel(Array.from({ length: units }, (_, i) => prize(`p${i}`, 1)));
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
