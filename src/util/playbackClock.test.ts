import { describe, expect, it } from 'vitest';

import { playbackClock } from './playbackClock';

describe('a clock the reader can pause and step through', () => {
  it('follows the frames while playing, a late frame moving it on by at most the cap', () => {
    const clock = playbackClock(10_000);
    expect(clock.tick(100)).toBe(0);
    expect(clock.tick(150)).toBe(50);
    expect(clock.tick(5_000)).toBe(1_050);
    expect(clock.tick(4_000)).toBe(1_050); // time never runs backwards
  });

  it('stands still while paused, and goes on from there', () => {
    const clock = playbackClock(10_000);
    clock.tick(0);
    clock.tick(500);
    clock.pause();
    expect(clock.playing).toBe(false);
    expect(clock.tick(900)).toBe(500);
    clock.play();
    expect(clock.tick(1_000)).toBe(600);
  });

  it('seeks within its length', () => {
    const clock = playbackClock(10_000);
    clock.seek(4_000);
    expect(clock.position).toBe(4_000);
    expect(clock.tick(0)).toBe(4_000);
    clock.seek(-5);
    expect(clock.tick(10)).toBe(10);
    clock.seek(99_000);
    expect(clock.tick(20)).toBe(10_000);
  });

  it('holds at its end, says it ended, and plays again from the start', () => {
    const clock = playbackClock(1_000);
    clock.tick(0);
    expect(clock.tick(900)).toBe(900);
    expect(clock.ended).toBe(false);
    expect(clock.tick(1_500)).toBe(1_000);
    expect(clock.ended).toBe(true);
    expect(clock.playing).toBe(false);
    expect(clock.tick(2_000)).toBe(1_000);
    clock.play();
    expect(clock.tick(2_100)).toBe(100);
    expect(clock.ended).toBe(true);
  });
});
