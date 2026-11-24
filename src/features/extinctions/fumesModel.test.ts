import { describe, expect, it } from 'vitest';

import { angularDistance } from '../../eclipses/visibility';
import { campFuming, emeishanFuming, puffAt, siberianFuming, ventsAround } from './fumesModel';

const KYR = 1000 * 365.25 * 86_400;

describe('the Siberian Traps’ fumes (#1192)', () => {
  it('are still before the first lavas, and pale while only the lavas erupt', () => {
    expect(siberianFuming(-350 * KYR)).toEqual({ lava: 0, gas: 0, haze: 0 });
    const lavas = siberianFuming(-200 * KYR);
    expect(lavas.lava).toBe(1);
    expect(lavas.gas).toBe(0);
    expect(lavas.haze).toBeCloseTo(0.25);
  });

  it('darken with the sills’ gas from the extinction’s start, the haze at its thickest', () => {
    const dying = siberianFuming(30 * KYR);
    expect(dying.gas).toBe(1);
    expect(dying.haze).toBe(1);
    expect(siberianFuming(-5 * KYR).gas).toBeCloseTo(0.5);
  });

  it('wane after it: the gas gone by 200,000 years, the lavas by 600,000, the haze between', () => {
    expect(siberianFuming(200 * KYR).gas).toBe(0);
    expect(siberianFuming(300 * KYR).lava).toBeGreaterThan(0);
    expect(siberianFuming(300 * KYR).haze).toBeGreaterThan(siberianFuming(300 * KYR).lava * 0.25);
    expect(siberianFuming(700 * KYR)).toEqual({ lava: 0, gas: 0, haze: 0 });
  });

  it('come from vents spread over the traps round their centre, the same each time', () => {
    const center = { latitude: 56, longitude: 36 };
    const vents = ventsAround(center, 14, 9);
    expect(vents).toHaveLength(14);
    expect(ventsAround(center, 14, 9)).toEqual(vents);
    for (const vent of vents) expect(angularDistance(vent, center)).toBeLessThan(10);
    const spread = Math.max(...vents.map((vent) => angularDistance(vent, center)));
    expect(spread).toBeGreaterThan(6);
  });

  it('rise in puffs that widen, drift east and fade, none fuming when the traps are still', () => {
    const low = puffAt(0, 4, 0.05, 1);
    const high = puffAt(0, 4, 0.7, 1);
    expect(high.height).toBeGreaterThan(low.height);
    expect(high.size).toBeGreaterThan(low.size);
    expect(high.east).toBeGreaterThan(low.east);
    expect(puffAt(0, 4, 0.95, 1).opacity).toBeLessThan(puffAt(0, 4, 0.5, 1).opacity);
    expect(puffAt(1, 4, 0.3, 0).opacity).toBe(0);
    // The cycle goes round, backwards too.
    expect(puffAt(0, 4, 1.3, 1)).toEqual(puffAt(0, 4, 0.3, 1));
    expect(puffAt(0, 4, -0.7, 1).height).toBeCloseTo(puffAt(0, 4, 0.3, 1).height);
  });
});

describe('the other provinces’ fumes (#1201)', () => {
  it('the Central Atlantic: dimly from its intrusions, then four pulses of lava over 600,000 years', () => {
    expect(campFuming(-200 * KYR)).toEqual({ lava: 0, gas: 0, haze: 0 });
    expect(campFuming(-50 * KYR).gas).toBeCloseTo(0.45);
    expect(campFuming(-50 * KYR).lava).toBe(0);
    for (const at of [10, 210, 410, 610]) expect(campFuming(at * KYR).lava).toBe(1);
    expect(campFuming(150 * KYR).lava).toBe(0);
    expect(campFuming(10 * KYR).gas).toBe(1);
    expect(campFuming(800 * KYR)).toEqual({ lava: 0, gas: 0, haze: 0 });
  });

  it('the Emeishan Traps: from the extinction’s start, the lavas waning over three million years', () => {
    expect(emeishanFuming(-10 * KYR)).toEqual({ lava: 0, gas: 0, haze: 0 });
    expect(emeishanFuming(50 * KYR)).toMatchObject({ lava: 1, gas: 1 });
    expect(emeishanFuming(1000 * KYR).lava).toBeGreaterThan(0);
    expect(emeishanFuming(1000 * KYR).gas).toBe(0);
    expect(emeishanFuming(3000 * KYR).lava).toBe(0);
  });
});
