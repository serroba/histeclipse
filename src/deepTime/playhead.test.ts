import { describe, expect, it } from 'vitest';

import { speedAlong } from './playAxis';
import { axisPlayhead, playhead } from './playhead';
import { roundMa } from './scale';

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

describe('playing along a part’s own timeline (#1276)', () => {
  /** Ten seconds from 1 Ma to today, evenly. */
  const axis = { at: (ma: number) => (1 - ma) * 10, ma: (seconds: number) => 1 - seconds / 10 };

  it('keeps its place unrounded, at the share of the pace, a stalled frame not leaping', () => {
    const head = axisPlayhead();
    const first = head.step(axis, 1, 1, 1 / 60);
    expect(first).toBeCloseTo(1 - 1 / 600, 9);
    // Twice as fast: two frames' worth, on from where it was, not from the rounded view.
    const second = head.step(axis, roundMa(first), 2, 1 / 60);
    expect(second).toBeCloseTo(1 - 3 / 600, 9);
    // A stall of a second counts as a quarter.
    expect(head.step(axis, roundMa(second), 1, 1)).toBeCloseTo(1 - 3 / 600 - 0.025, 9);
  });

  it('carries on from what is shown when the reader moved it, and stops at today', () => {
    const head = axisPlayhead();
    head.step(axis, 1, 1, 0.1);
    expect(head.step(axis, 0.5, 1, 0.1)).toBeCloseTo(0.49, 9);
    expect(head.step(axis, 0.49, 100, 0.25)).toBe(0);
  });

  it('says the speed at each moment along it', () => {
    expect(speedAlong(axis, 0.5, 1)).toBeCloseTo(0.1);
    expect(speedAlong(axis, 0.5, 2)).toBeCloseTo(0.2);
    // At today, nothing left to go.
    expect(speedAlong({ at: axis.at, ma: (s) => Math.max(0, axis.ma(s)) }, 0, 1)).toBe(0);
  });
});
