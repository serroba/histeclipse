import { describe, expect, it } from 'vitest';

import {
  litShare,
  moonFacts,
  moonPhaseName,
  moonText,
  planetFacts,
  planetText,
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
