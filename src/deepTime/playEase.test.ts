import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { EASE_FLOOR, easeAt } from './playEase';
import { playhead } from './playhead';

describe('playing eases near milestones and finds (#1077)', () => {
  it('Given no mark near, Then full pace; on a mark, a fifth; between, between', () => {
    expect(easeAt(100, 20, [])).toBe(1);
    expect(easeAt(100, 20, [200])).toBe(1);
    expect(easeAt(66, 20, [66])).toBe(EASE_FLOOR);
    const near = easeAt(76, 20, [66]);
    expect(near).toBeGreaterThan(EASE_FLOOR);
    expect(near).toBeLessThan(1);
    expect(easeAt(80, 0, [80])).toBe(1);
  });

  it('Given any moment and marks, Then the share is between the floor and 1, the nearest mark deciding', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 540, noNaN: true }),
        fc.double({ min: 0.001, max: 100, noNaN: true }),
        fc.array(fc.double({ min: 0, max: 540, noNaN: true }), { maxLength: 6 }),
        (ma, speed, marks) => {
          const share = easeAt(ma, speed, marks);
          expect(share).toBeGreaterThanOrEqual(EASE_FLOOR);
          expect(share).toBeLessThanOrEqual(1);
          const nearest = marks.reduce(
            (best, mark) => Math.min(best, Math.abs(ma - mark)),
            Infinity,
          );
          expect(share).toBeCloseTo(
            easeAt(ma, speed, nearest === Infinity ? [] : [ma - nearest]),
            9,
          );
        },
      ),
    );
  });

  it('Given play through the K–Pg boundary at 20 Myr/s, Then it lingers there, the same at 30 or 120 frames a second', () => {
    const run = (fps: number): { seconds: number; nearSeconds: number } => {
      const head = playhead();
      let ma = 100;
      let seconds = 0;
      let nearSeconds = 0;
      while (ma > 40 && seconds < 60) {
        const share = easeAt(ma, 20, [66]);
        ma = head.step(ma, 20 * share, 1 / fps);
        seconds += 1 / fps;
        if (Math.abs(ma - 66) < 5) nearSeconds += 1 / fps;
      }
      return { seconds, nearSeconds };
    };
    const [slow, fast] = [run(30), run(120)];
    // Unslowed, 60 Myr at 20 Myr/s is 3 s, and the 10 Myr about 66 Ma half a second.
    expect(slow.seconds).toBeGreaterThan(3.5);
    expect(slow.nearSeconds).toBeGreaterThan(1.2);
    expect(Math.abs(slow.seconds - fast.seconds)).toBeLessThan(0.2);
  });
});
