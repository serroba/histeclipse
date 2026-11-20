import { describe, expect, it } from 'vitest';

import { eclipseFraming } from './framing';

describe('where the globe turns for a picked eclipse (#947)', () => {
  const greatest = { latitude: 68, longitude: 5.6 };

  it('Given no place, Then it turns to greatest eclipse', () => {
    expect(eclipseFraming(greatest, null)).toEqual(greatest);
  });

  it('Given a place near greatest eclipse (Athens, 431 BCE), Then it turns halfway between', () => {
    const athens = { latitude: 38, longitude: 23.7 };
    const framed = eclipseFraming(greatest, athens);
    expect(framed.latitude).toBeGreaterThan(48);
    expect(framed.latitude).toBeLessThan(58);
    expect(framed.longitude).toBeGreaterThan(5.6);
    expect(framed.longitude).toBeLessThan(23.7);
  });

  it('Given the Thales eclipse seen from Anatolia, about 60° of arc apart, Then both are in view', () => {
    const framed = eclipseFraming(
      { latitude: 38.1, longitude: -46 },
      { latitude: 39, longitude: 35 },
    );
    expect(framed.longitude).toBeGreaterThan(-20);
    expect(framed.longitude).toBeLessThan(10);
  });

  it('Given a place too far to share the view, Then it turns to the place', () => {
    const sydney = { latitude: -34, longitude: 151 };
    expect(eclipseFraming(greatest, sydney)).toEqual(sydney);
  });
});
