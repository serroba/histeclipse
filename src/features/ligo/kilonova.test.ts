import { describe, expect, it } from 'vitest';

import { HEAVY_ELEMENTS_CARD } from './eventCard';
import {
  EARTHS_PER_SUN,
  EJECTA,
  glowAt,
  heatingRate,
  KILONOVA_MS,
  kilonovaDays,
  kilonovaMs,
  kilonovaText,
  luminosity,
  peakDays,
  reachAu,
  SEEN,
} from './kilonova';

const [BLUE, RED] = EJECTA;

describe('the kilonova AT 2017gfo, as modelled (#992)', () => {
  it('flings out Kasen et al.’s two components: 0.025 Suns at 0.3c, and 0.04 at 0.1c, some 20,000 Earths', () => {
    expect(BLUE).toMatchObject({ name: 'blue', suns: 0.025, speed: 0.3 });
    expect(RED).toMatchObject({ name: 'red', suns: 0.04, speed: 0.1 });
    expect((BLUE.suns + RED.suns) * EARTHS_PER_SUN).toBeCloseTo(21_600, -2);
  });

  it('peaks the blue within about a day and the red after about ten, as Metzger’s t_peak gives', () => {
    // 1.6 d (M/0.01)^½ (v/0.1c)^−½ (κ)^½
    expect(peakDays(BLUE)).toBeCloseTo(1.6 * Math.sqrt(2.5 / 3 / 2), 9);
    expect(peakDays(BLUE)).toBeLessThan(1.5);
    expect(peakDays(RED)).toBeGreaterThan(7);
    expect(peakDays(RED)).toBeLessThan(14);
  });

  it('is heated as (t/day)^−1.3, and shines with all of it after its peak, less before', () => {
    expect(heatingRate(1)).toBeCloseTo(1e10, 0);
    expect(heatingRate(10) / heatingRate(1)).toBeCloseTo(10 ** -1.3, 9);
    expect(luminosity(BLUE, 0)).toBe(0);
    const peak = peakDays(BLUE);
    expect(luminosity(BLUE, 2 * peak)).toBeCloseTo(
      BLUE.suns * 1.9884e33 * heatingRate(2 * peak),
      -30,
    );
    expect(luminosity(BLUE, peak / 4)).toBeLessThan(BLUE.suns * 1.9884e33 * heatingRate(peak / 4));
    // About 10⁴¹–10⁴² erg/s at the blue's peak, as AT 2017gfo was.
    expect(luminosity(BLUE, peak)).toBeGreaterThan(1e41);
    expect(luminosity(BLUE, peak)).toBeLessThan(2e42);
  });

  it('glows blue first, its blue fading within days, then mostly red', () => {
    expect(glowAt(0.5).blueShare).toBeGreaterThan(0.9);
    expect(glowAt(1).blue).toBeGreaterThan(0.95);
    expect(glowAt(4).blue).toBeLessThan(0.3);
    expect(glowAt(peakDays(RED)).red).toBeCloseTo(1, 9);
    expect(glowAt(14).blueShare).toBeLessThan(0.45);
    expect(glowAt(0)).toEqual({ days: 0, blue: 0, red: 0, blueShare: 0 });
  });

  it('puts the fast edge about 52 AU out a day after, 0.3c times the time', () => {
    expect(reachAu(BLUE, 1)).toBeCloseTo(51.9, 1);
    expect(reachAu(RED, 1)).toBeCloseTo(reachAu(BLUE, 1) / 3, 9);
  });

  it('runs its clock from an hour to four weeks, on a log scale, looping after a rest', () => {
    expect(kilonovaDays(0)).toBeCloseTo(1 / 24, 9);
    expect(kilonovaDays(KILONOVA_MS.glow)).toBeCloseTo(28, 9);
    expect(kilonovaDays(KILONOVA_MS.glow + KILONOVA_MS.rest)).toBeCloseTo(1 / 24, 9);
    expect(kilonovaDays(kilonovaMs(1.5))).toBeCloseTo(1.5, 9);
    expect(kilonovaMs(100)).toBeCloseTo(KILONOVA_MS.glow, 6);
  });

  it('says when, what colour, how far out, and what was seen then', () => {
    expect(kilonovaText(0.3)).toBe(
      '7 h after the merger · mostly blue light · its fast edge 16 AU out',
    );
    expect(kilonovaText(1.5)).toContain('Day 1.5');
    expect(kilonovaText(1.5)).toContain('strontium seen in its spectrum');
    expect(kilonovaText(16)).toContain('radio waves seen by the VLA');
    expect(kilonovaText(16)).toContain('mostly red and infrared light');
    expect(kilonovaText(5)).toContain('blue and red light');
    expect(SEEN.map((event) => event.days)).toEqual(
      [...SEEN.map((event) => event.days)].sort((a, b) => a - b),
    );
  });
});

describe('the heavy elements card (#992)', () => {
  const said = new Map(HEAVY_ELEMENTS_CARD.facts);

  it('keeps detected, inferred, not seen and expected apart', () => {
    expect([...said.keys()]).toEqual([
      'Flung out',
      'Detected',
      'Inferred',
      'Inferred: gold',
      'Not seen',
      'Expected',
      'Seen since',
    ]);
    expect(said.get('Detected')).toContain('Strontium');
    expect(said.get('Detected')).toContain('only element named directly');
    expect(said.get('Inferred: gold')).toContain('3 to 13 Earths');
    expect(said.get('Not seen')).toContain('gold or platinum');
  });

  it('gives Earths that match the Suns it quotes', () => {
    // Strontium: 1 to 5 × 10⁻⁵ Suns.
    expect(1e-5 * EARTHS_PER_SUN).toBeCloseTo(3.3, 1);
    expect(5e-5 * EARTHS_PER_SUN).toBeCloseTo(16.6, 1);
  });

  it('gives both readings of where most gold is made', () => {
    expect(HEAVY_ELEMENTS_CARD.note).toContain('Kasen et al. (2017)');
    expect(HEAVY_ELEMENTS_CARD.note).toContain('collapsars');
    expect(HEAVY_ELEMENTS_CARD.links.length).toBe(7);
  });
});
