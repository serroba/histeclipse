import { describe, expect, it } from 'vitest';

import {
  earthFromFacts,
  earthFromText,
  planetFacts,
  planetText,
  litShare,
  moonFacts,
  moonPhaseName,
  moonText,
  sunText,
} from './bodyFacts';
import type { EquatorialVector } from './moon';

const AU = 149_597_870.7;
/** A point on the J2000 equator (on the ecliptic at 0° and 180°), `km` away at `degrees`. */
const at = (degrees: number, km: number): EquatorialVector => [
  km * Math.cos((degrees * Math.PI) / 180),
  km * Math.sin((degrees * Math.PI) / 180),
  0,
];

describe('what can be said of the bodies', () => {
  it('lights a disc by its phase angle', () => {
    expect(litShare(0)).toBe(1);
    expect(litShare(180)).toBeCloseTo(0);
    expect(litShare(90)).toBeCloseTo(0.5);
  });

  it('names the Moon’s phase by how far it stands east of the Sun', () => {
    expect(moonPhaseName(0)).toBe('New Moon');
    expect(moonPhaseName(45)).toBe('Waxing crescent');
    expect(moonPhaseName(90)).toBe('First quarter');
    expect(moonPhaseName(180)).toBe('Full Moon');
    expect(moonPhaseName(-90)).toBe('Last quarter');
    expect(moonPhaseName(-20)).toBe('New Moon');
  });

  it('gives the full Moon opposite the Sun, all lit, at its distance', () => {
    const facts = moonFacts(at(180, 384_400), at(0, AU));
    expect(facts.phase).toBe('Full Moon');
    expect(facts.lit).toBeCloseTo(1, 2);
    expect(moonText(facts)).toBe('Full Moon, 100% lit · 384,000 km from Earth');
  });

  it('gives a first-quarter Moon half lit', () => {
    const facts = moonFacts(at(0, 384_400), at(-90, AU));
    expect(facts.phase).toBe('First quarter');
    expect(facts.lit).toBeCloseTo(0.5, 2);
  });

  it('puts Venus east of the Sun in the evening sky, part lit, bright', () => {
    // Venus at greatest eastern elongation: 0.72 AU from the Sun, the angle at Venus a right
    // angle, so sin(elongation) = 0.72 and Venus is √(1 − 0.72²) AU from Earth.
    const sun = at(0, AU);
    const elongation = (Math.asin(0.72) * 180) / Math.PI;
    const venus = at(elongation, Math.sqrt(1 - 0.72 ** 2) * AU);
    const facts = planetFacts('venus', venus, sun);
    expect(facts.fromSunAu).toBeCloseTo(0.72, 2);
    expect(facts.evening).toBe(true);
    expect(facts.elongation).toBeCloseTo(46.05, 1);
    expect(facts.lit).toBeCloseTo(0.5, 2);
    expect(facts.magnitude).toBeLessThan(-4);
    expect(planetText(facts)).toMatch(
      /^0\.69 AU from Earth, 0\.72 from the Sun · 50% lit, magnitude −4\.\d · in the evening sky, 46° east of the Sun$/,
    );
  });

  it('says a planet near the Sun is lost in its glare, and one west of it is in the morning sky', () => {
    const sun = at(0, AU);
    expect(planetText(planetFacts('mars', at(5, 2.5 * AU), sun))).toContain(
      'lost in the Sun’s glare',
    );
    expect(planetText(planetFacts('jupiter', at(-60, 5 * AU), sun))).toContain('morning sky');
  });

  it('gives the Sun’s distance', () => {
    expect(sunText(1)).toBe('1.0000 AU (149,600,000 km) from Earth');
  });
});

describe('Earth seen from afar', () => {
  const AU = 149_597_870.7;

  it('from Jupiter at opposition: Earth between, its night side toward Jupiter, on the Sun', () => {
    const facts = earthFromFacts([4 * AU, 0, 0], [-AU, 0, 0]);
    expect(facts.au).toBeCloseTo(4, 6);
    // 12,756 km at 4 AU.
    expect(facts.diameter).toBeCloseTo(4.4, 1);
    expect(facts.lit).toBeCloseTo(0, 6);
    expect(facts.fromSun).toBeCloseTo(0, 6);
    expect(earthFromText(facts)).toBe(
      '4.00 AU away, 4.4″ across, 0% lit · 0° from the Sun, in its glare · the Moon at most 133″ from it',
    );
  });

  it('from Mars at quadrature: Earth half lit, far from the Sun in that sky', () => {
    // Mars along +x 0.5 AU from Earth, the Sun along +y: a right angle at Earth.
    const facts = earthFromFacts([0.5 * AU, 0, 0], [0, AU, 0]);
    expect(facts.lit).toBeCloseTo(0.5, 6);
    expect(facts.fromSun).toBeCloseTo(Math.atan2(1, 0.5) * (180 / Math.PI), 6);
    expect(earthFromText(facts)).toMatch(
      /^0\.50 AU away, 35\.2″ across, 50% lit · 63° from the Sun · /,
    );
  });

  it('from the Moon, Earth spans degrees: given in arcminutes', () => {
    const facts = earthFromFacts([384_400, 0, 0], [AU, 0, 0]);
    expect(earthFromText(facts)).toMatch(/^0\.00 AU away, 11\d\.\d′ across, 100% lit/);
  });

  it('from the Sun: all of Earth lit, and no "from the Sun"', () => {
    const facts = earthFromFacts([AU, 0, 0], [AU, 0, 0]);
    expect(facts.fromSun).toBeNull();
    expect(earthFromText(facts)).toMatch(/^1\.00 AU away, 17\.6″ across, 100% lit · the Moon/);
  });
});
