import { describe, expect, it } from 'vitest';
import { angleDelta, BUTTON_SPIN_SPEED, flickVelocity, MIN_FLICK_SPEED, pointerAngle, spinFromFlick } from '../spinGesture';
import { buildWheel, curveAngle, landingCurve, landingFor } from '../wheelLayout';

describe('dragging the wheel', () => {
  it('reads the direction of the pointer around the centre', () => {
    expect(pointerAngle(100, 100, 200, 100)).toBeCloseTo(0);
    expect(pointerAngle(100, 100, 100, 200)).toBeCloseTo(90);
    expect(pointerAngle(100, 100, 0, 100)).toBeCloseTo(180);
    expect(pointerAngle(100, 100, 100, 0)).toBeCloseTo(-90);
  });

  it('follows the finger the short way round, also across the -180/180 seam', () => {
    expect(angleDelta(10, 40)).toBe(30);
    expect(angleDelta(40, 10)).toBe(-30);
    expect(angleDelta(170, -170)).toBe(20);
    expect(angleDelta(-170, 170)).toBe(-20);
  });

  it('measures how hard the wheel was thrown from the end of the drag only', () => {
    // Slow start, then a quick throw: 90 degrees in the last 100 ms.
    const samples = [
      { time: 0, rotation: 0 },
      { time: 400, rotation: 10 },
      { time: 450, rotation: 55 },
      { time: 500, rotation: 100 },
    ];
    expect(flickVelocity(samples, 500)).toBeCloseTo(900);
    // Held still before letting go: the old movement no longer counts.
    expect(flickVelocity(samples, 900)).toBe(0);
    expect(flickVelocity([{ time: 0, rotation: 0 }], 0)).toBe(0);
  });
});

describe('turning the throw into a spin', () => {
  it('ignores a nudge', () => {
    expect(spinFromFlick(MIN_FLICK_SPEED - 1)).toBeNull();
    expect(spinFromFlick(-(MIN_FLICK_SPEED - 1))).toBeNull();
    expect(spinFromFlick(0)).toBeNull();
  });

  it('keeps the direction, and harder throws spin faster and longer within limits', () => {
    const gentle = spinFromFlick(250)!;
    const hard = spinFromFlick(1400)!;
    const wild = spinFromFlick(9000)!;
    expect(gentle.velocity).toBeGreaterThan(250); // a weak but valid throw still gives a proper spin
    expect(hard.velocity).toBeGreaterThan(gentle.velocity);
    expect(hard.seconds).toBeGreaterThan(gentle.seconds);
    expect(wild.velocity).toBeLessThanOrEqual(1600);
    expect(wild.seconds).toBeLessThanOrEqual(6.5);
    expect(spinFromFlick(-1400)).toEqual({ velocity: -hard.velocity, seconds: hard.seconds });
    expect(spinFromFlick(BUTTON_SPIN_SPEED)).not.toBeNull();
  });
});

describe('wherever it is thrown, the wheel stops on the drawn prize', () => {
  const prizes = [
    { id: 'shirt', name: 'Camiseta', remainingUnits: 3, imageUrl: null },
    { id: 'mug', name: 'Caneca', remainingUnits: 1, imageUrl: null },
    { id: 'cap', name: 'Boné', remainingUnits: 2, imageUrl: null },
  ];
  const segments = buildWheel(prizes);
  const underPointer = (rotation: number) => {
    const at = (((-rotation % 360) + 360) % 360);
    return segments.find((segment) => at >= segment.start && at < segment.end)?.targetId;
  };

  it.each([
    ['clockwise, gentle', 250, 37],
    ['clockwise, hard', 1500, -812],
    ['counterclockwise, gentle', -300, 5],
    ['counterclockwise, hard', -1600, 1234.5],
  ])('%s', (_label, thrown, startAngle) => {
    for (const prize of prizes) {
      const landing = landingFor(segments, prize.id, 'draw-1')!;
      const spin = spinFromFlick(thrown)!;
      const curve = landingCurve(startAngle, spin.velocity, landing.angle, spin.seconds);

      expect(curveAngle(curve, 0)).toBeCloseTo(startAngle);
      expect(underPointer(curveAngle(curve, spin.seconds))).toBe(prize.id);

      // Keeps turning the way it was thrown and only slows down.
      const direction = Math.sign(spin.velocity);
      let previousSpeed = Infinity;
      for (let t = 0; t < spin.seconds - 0.05; t += 0.05) {
        const speed = (direction * (curveAngle(curve, t + 0.01) - curveAngle(curve, t))) / 0.01;
        expect(speed).toBeGreaterThanOrEqual(-1e-6);
        expect(speed).toBeLessThanOrEqual(previousSpeed + 1e-6);
        previousSpeed = speed;
      }
      // At least one full turn: a spin, not a slide.
      expect(Math.abs(curveAngle(curve, spin.seconds) - startAngle)).toBeGreaterThanOrEqual(360);
    }
  });
});
