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

  it('stands still while held, frames passing, and runs on from there (#807)', () => {
    const clock = frameClock();
    clock.tick(0);
    clock.tick(100);
    clock.hold(true);
    expect(clock.held()).toBe(true);
    expect(clock.tick(900)).toBe(100);
    clock.hold(false);
    expect(clock.tick(950)).toBe(150);
  });

  it('is nudged on and back by a step, never to before it began', () => {
    const clock = frameClock();
    clock.tick(0);
    clock.nudge(250);
    expect(clock.tick(0)).toBe(250);
    clock.nudge(-1000);
    expect(clock.tick(0)).toBe(0);
  });
});
