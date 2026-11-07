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
    const clock = frameClock();
    clock.tick(0);
    clock.tick(16);
    // The page was busy for six seconds: a second of animation, not six.
    expect(clock.tick(6016)).toBe(1016);
    expect(clock.tick(6032)).toBe(1032);
  });

  it('keeps pace with a slow device, a frame every half second', () => {
    const clock = frameClock();
    clock.tick(0);
    expect(clock.tick(500)).toBe(500);
    expect(clock.tick(1000)).toBe(1000);
  });

  it('never runs backward', () => {
    const clock = frameClock();
    clock.tick(100);
    expect(clock.tick(50)).toBe(0);
  });
});
