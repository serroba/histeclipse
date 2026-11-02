import { describe, expect, it } from 'vitest';

import { playhead } from './playhead';

const ICE_SPEED = 0.05;

/** Play for `seconds` at `rate` frames a second, the view showing the rounded date each frame. */
function play(start: number, speed: number, rate: number, seconds: number): number {
  const head = playhead();
  let shown = start;
  for (let frame = 0; frame < Math.round(seconds * rate); frame += 1) {
    shown = head.step(shown, speed, 1 / rate);
  }
  return shown;
}

describe('playing deep time', () => {
  it.each([30, 60, 120, 144, 240])(
    'moves the ice ages 50,000 years a second at %i frames a second',
    (rate) => {
      expect(play(2.58, ICE_SPEED, rate, 2)).toBeCloseTo(2.48, 3);
    },
  );

  it('stops at the present', () => {
    expect(play(0.01, ICE_SPEED, 60, 1)).toBe(0);
  });

  it('carries on from where the reader moves the slider', () => {
    const head = playhead();
    expect(head.step(1, ICE_SPEED, 0.2)).toBe(0.99);
    expect(head.step(2, ICE_SPEED, 0.2)).toBe(1.99);
  });

  it('takes no leap after a stalled frame', () => {
    expect(playhead().step(100, 20, 5)).toBe(95);
  });
});
