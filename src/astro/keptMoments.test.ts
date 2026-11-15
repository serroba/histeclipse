import { describe, expect, it, vi } from 'vitest';

import type { JulianDay } from '../time/julianDay';
import { keptMoon, keptPlanets } from './keptMoments';
import type { PlanetEphemeris } from './planets';

const jd = (day: number): JulianDay => day as JulianDay;

describe('the theories, their last few moments kept (#766)', () => {
  it('Given the Moon asked twice at a moment, Then its series is summed once, and a few moments are kept', () => {
    const position = vi.fn((at: JulianDay): [number, number, number] => [at, 0, 0]);
    const moon = keptMoon({ position });
    expect(moon.position(jd(1))).toEqual([1, 0, 0]);
    expect(moon.position(jd(1))).toEqual([1, 0, 0]);
    expect(position).toHaveBeenCalledOnce();
    for (const day of [2, 3, 4]) moon.position(jd(day));
    moon.position(jd(1));
    expect(position).toHaveBeenCalledTimes(4);
    // A fifth moment lets the oldest go.
    moon.position(jd(5));
    moon.position(jd(1));
    expect(position).toHaveBeenCalledTimes(6);
  });

  it('Given a planet asked twice at a moment, Then once; each planet apart; seen and heliocentric as they are', () => {
    const position = vi.fn((planet: string, at: JulianDay): [number, number, number] => [
      planet.length,
      at,
      0,
    ]);
    const exact = {
      position,
      apparent: vi.fn((): [number, number, number] => [1, 1, 1]),
      heliocentric: vi.fn((): [number, number, number] => [2, 2, 2]),
    } as unknown as PlanetEphemeris;
    const planets = keptPlanets(exact);
    expect(planets.position('mars', jd(7))).toEqual([4, 7, 0]);
    expect(planets.position('mars', jd(7))).toEqual([4, 7, 0]);
    expect(planets.position('venus', jd(7))).toEqual([5, 7, 0]);
    expect(position).toHaveBeenCalledTimes(2);
    expect(planets.apparent('mars', jd(7))).toEqual([1, 1, 1]);
    expect(planets.heliocentric('earth', 7)).toEqual([2, 2, 2]);
  });
});
