import { describe, expect, it } from 'vitest';

import { lateDeltaT, lateEphemerides, lateTimeline } from './part';

describe('the timeline the parts ask of', () => {
  it('Given nothing bound yet, Then nothing travels or plays, the maps reach their default and Earth faces the moment', () => {
    const { timeline } = lateTimeline(540);
    expect([
      timeline.travelling(),
      timeline.playing(),
      timeline.oldest(),
      timeline.earthFace(2_451_545.3),
    ]).toEqual([false, false, 540, 2_451_545.3]);
  });

  it('Given the years, deep time and the launches bound, Then it asks them', () => {
    const late = lateTimeline(540);
    late.bind({
      years: { travelling: () => true },
      deepTime: { playing: () => true, oldest: () => 1800 },
      launches: { earthFace: (jd) => Math.round(jd) },
    });
    expect([
      late.timeline.travelling(),
      late.timeline.playing(),
      late.timeline.oldest(),
      late.timeline.earthFace(2_451_545.3),
    ]).toEqual([true, true, 1800, 2_451_545]);
  });
});

describe('the ephemerides the parts ask of', () => {
  it('Given the bodies not yet mounted, Then no theory has loaded, and a load waits for them', async () => {
    const late = lateEphemerides();
    const { ephemerides } = late;
    expect(ephemerides.moon()).toBeNull();
    expect(ephemerides.moonAt(2451545 as never)).toBeNull();
    expect(ephemerides.planets()).toBeNull();
    expect(ephemerides.planetPositions(2451545 as never)).toBeNull();
    expect(ephemerides.planetsSeen(2451545 as never, [0, 0, 0], [0, 0, 0])).toEqual([]);
    const loading = ephemerides.loadPlanets();
    const planets = { name: 'theory' } as never;
    late.bind({
      moon: () => ({ name: 'moon' }) as never,
      moonAt: () => [1, 2, 3],
      planets: () => planets,
      loadPlanets: () => Promise.resolve(planets),
      planetPositions: () => ({}) as never,
      planetsSeen: () => [],
    });
    await expect(loading).resolves.toBe(planets);
    expect(ephemerides.moon()).toEqual({ name: 'moon' });
    expect(ephemerides.moonAt(2451545 as never)).toEqual([1, 2, 3]);
    expect(ephemerides.planets()).toBe(planets);
    expect(ephemerides.planetPositions(2451545 as never)).toEqual({});
    expect(ephemerides.planetsSeen(2451545 as never, [0, 0, 0], [0, 0, 0])).toEqual([]);
  });
});

describe('ΔT the parts ask for', () => {
  it('Given it not yet loaded, Then asking says so; once bound, Then it is the table', () => {
    const late = lateDeltaT();
    expect(() => late.deltaT()).toThrow('ΔT asked for before it loaded');
    const table = { firstYear: -9700 } as never;
    late.bind(table);
    expect(late.deltaT()).toBe(table);
  });
});
