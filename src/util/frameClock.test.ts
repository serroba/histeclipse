import { describe, expect, it } from 'vitest';

import { frameClock } from './frameClock';

describe('frameClock', () => {
  it('starts at the first frame and follows the frames', () => {
    const clock = frameClock();
    expect(clock.tick(5000)).toBe(0);
    expect(clock.tick(5016)).toBe(16);
    expect(clock.tick(5032)).toBe(32);
  });

  it('pauses through a hitch instead of skipping ahead', () => {
    const clock = frameClock(100);
    clock.tick(0);
    clock.tick(16);
    // The page was busy for six seconds.
    expect(clock.tick(6016)).toBe(116);
    expect(clock.tick(6032)).toBe(132);
  });

  it('never runs backward', () => {
    const clock = frameClock();
    clock.tick(100);
    expect(clock.tick(50)).toBe(0);
  });
});
