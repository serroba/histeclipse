import { describe, expect, it } from 'vitest';

import {
  isMoonBody,
  MOON_MAPS,
  MOON_RADIUS_KM,
  MOON_VIEWS,
  moonPlanet,
  moonRadius,
} from './moonLook';
import { pickedView } from './planetLook';
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

describe('Titan by more than one light', () => {
  it('Given Titan, Then its usual view is its near-infrared map, then radar, then its haze', () => {
    const views = MOON_VIEWS.titan ?? [];
    expect(views.map(({ key }) => key)).toEqual(['infrared', 'radar', 'haze']);
    expect(pickedView(views, 'look').map).toBe(MOON_MAPS.titan?.map);
    expect(pickedView(views, 'radar').sharp).toBe('textures/moons/titan-radar-4096.jpg');
    // As it looks: no map, its painted colour.
    expect(pickedView(views, 'haze').map).toBeNull();
  });

  it('Given a moon seen by one light only, Then it has no Light switch', () => {
    expect(MOON_VIEWS.europa).toBeUndefined();
  });
});
