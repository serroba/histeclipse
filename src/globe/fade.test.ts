import { describe, expect, it } from 'vitest';

import { createFade, type FadeClock } from './fade';

/** A clock moved by hand, its frames run when asked. */
function handClock(reduced = false) {
  let time = 0;
  let frames: (() => void)[] = [];
  const clock: FadeClock = {
    now: () => time,
    frame: (step) => {
      frames.push(step);
    },
    reduced: () => reduced,
  };
  return {
    clock,
    /** Move on by `ms` and run the frames waiting. */
    tick: (ms: number) => {
      time += ms;
      const due = frames;
      frames = [];
      for (const step of due) step();
    },
  };
}

describe('createFade', () => {
  it('Given a first value, Then it is drawn at once', () => {
    const { clock } = handClock();
    const drawn: number[] = [];
    createFade((value) => drawn.push(value), 700, clock).set(1);
    expect(drawn).toEqual([1]);
  });

  it('Given a new target, Then it eases there over the time given, and stops', () => {
    const { clock, tick } = handClock();
    const drawn: number[] = [];
    const fade = createFade((value) => drawn.push(value), 700, clock);
    fade.set(1);
    fade.set(0);
    tick(350);
    expect(drawn.at(-1)).toBeCloseTo(0.5);
    tick(350);
    expect(drawn.at(-1)).toBe(0);
    const count = drawn.length;
    tick(100);
    expect(drawn).toHaveLength(count);
  });

  it('Given a turn back halfway, Then it eases back from where it was, not from the end', () => {
    const { clock, tick } = handClock();
    const drawn: number[] = [];
    const fade = createFade((value) => drawn.push(value), 700, clock);
    fade.set(1);
    fade.set(0);
    tick(350);
    fade.set(1);
    tick(1);
    expect(drawn.at(-1)).toBeGreaterThan(0.45);
    expect(drawn.at(-1)).toBeLessThan(0.55);
    tick(700);
    expect(drawn.at(-1)).toBe(1);
  });

  it('Given less motion asked for, or a jump, Then it goes at once', () => {
    const reduced = handClock(true);
    const drawn: number[] = [];
    const fade = createFade((value) => drawn.push(value), 700, reduced.clock);
    fade.set(1);
    fade.set(0);
    expect(drawn).toEqual([1, 0]);
    const plain = handClock();
    const jumped: number[] = [];
    const other = createFade((value) => jumped.push(value), 700, plain.clock);
    other.set(1);
    other.set(0, true);
    expect(jumped).toEqual([1, 0]);
  });

  it('Given the same target again, Then nothing is drawn', () => {
    const { clock } = handClock();
    const drawn: number[] = [];
    const fade = createFade((value) => drawn.push(value), 700, clock);
    fade.set(1);
    fade.set(1);
    expect(drawn).toEqual([1]);
  });
});
