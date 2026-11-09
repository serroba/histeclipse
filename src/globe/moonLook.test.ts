import { describe, expect, it } from 'vitest';

import { isMoonBody, MOON_RADIUS_KM, moonPlanet, moonRadius } from './moonLook';
import { EARTH_RADIUS_KM } from './spaceFrame';

describe('the moons drawn: whose they are and how big', () => {
  it('Given a body, Then only the planets’ moons count as moons, not ours', () => {
    expect(isMoonBody('titan')).toBe(true);
    expect(isMoonBody('moon')).toBe(false);
    expect(isMoonBody('saturn')).toBe(false);
  });

  it('Given a moon, Then it goes round its own planet', () => {
    expect(moonPlanet('deimos')).toBe('mars');
    expect(moonPlanet('callisto')).toBe('jupiter');
    expect(moonPlanet('iapetus')).toBe('saturn');
  });

  it('Given Ganymede, Then its radius is in Earth radii, the scene’s unit', () => {
    expect(moonRadius('ganymede')).toBeCloseTo(MOON_RADIUS_KM.ganymede / EARTH_RADIUS_KM, 9);
    expect(MOON_RADIUS_KM.ganymede).toBeGreaterThan(MOON_RADIUS_KM.titan);
  });
});
