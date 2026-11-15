import { describe, expect, it } from 'vitest';

import { lateEphemerides, lateTimeline } from './part';

describe('the timeline the parts ask of', () => {
  it('Given nothing bound yet, Then nothing travels or plays and the maps reach their default', () => {
    const { timeline } = lateTimeline(540);
    expect([timeline.travelling(), timeline.playing(), timeline.oldest()]).toEqual([
      false,
      false,
      540,
    ]);
  });

  it('Given the years and deep time bound, Then it asks them', () => {
    const late = lateTimeline(540);
    late.bind({
      years: { travelling: () => true },
      deepTime: { playing: () => true, oldest: () => 1800 },
    });
    expect([late.timeline.travelling(), late.timeline.playing(), late.timeline.oldest()]).toEqual([
      true,
      true,
      1800,
    ]);
  });
});

describe('the ephemerides the parts ask of', () => {
  it('Given the bodies not yet mounted, Then no theory has loaded, and a load waits for them', async () => {
    const late = lateEphemerides();
    const { ephemerides } = late;
    expect(ephemerides.moon()).toBeNull();
    expect(ephemerides.planets()).toBeNull();
    expect(ephemerides.planetPositions(2451545 as never)).toBeNull();
    expect(ephemerides.planetsSeen(2451545 as never, [0, 0, 0], [0, 0, 0])).toEqual([]);
    const loading = ephemerides.loadPlanets();
    const planets = { name: 'theory' } as never;
    late.bind({
      moon: () => ({ name: 'moon' }) as never,
      planets: () => planets,
      loadPlanets: () => Promise.resolve(planets),
      planetPositions: () => ({}) as never,
      planetsSeen: () => [],
    });
    await expect(loading).resolves.toBe(planets);
    expect(ephemerides.moon()).toEqual({ name: 'moon' });
    expect(ephemerides.planets()).toBe(planets);
    expect(ephemerides.planetPositions(2451545 as never)).toEqual({});
    expect(ephemerides.planetsSeen(2451545 as never, [0, 0, 0], [0, 0, 0])).toEqual([]);
  });
});
