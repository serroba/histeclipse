import { describe, expect, it } from 'vitest';

import { THEIA_CHOICES } from '../../deepTime/theia';
import {
  flashAt,
  IMMEDIATE_ORBIT,
  strikeAngle,
  glowColour,
  MOON_ORBIT,
  MOON_RADIUS,
  moonAt,
  moonColour,
  onDisc,
  pieceAt,
  pieces,
  ROCHE,
  STRIKE_ANGLE,
  THEIA_RADIUS,
  theiaAt,
  turned,
  type Triple,
} from './impactModel';

const HOUR = 3600;
const DAY = 86_400;
const YEAR = 365.25 * DAY;
const length = ([x, y, z]: Triple): number => Math.hypot(x, y, z);

describe('the canonical giant impact, drawn (#180)', () => {
  it('brings Theia in on a grazing path at about escape speed, touching Earth at the impact', () => {
    const contact = theiaAt(0);
    expect(contact?.opacity).toBe(1);
    // At the proto-Earth's size then, nine tenths of today's mass.
    expect(length(contact?.center ?? [0, 0, 0])).toBeCloseTo(Math.cbrt(0.89) + THEIA_RADIUS);
    // Two hours out, some ten Earth radii away: 9.3 km/s.
    const coming = theiaAt(-2 * HOUR);
    expect(length(coming?.center ?? [0, 0, 0])).toBeGreaterThan(9);
    expect(length(coming?.center ?? [0, 0, 0])).toBeLessThan(12);
    // Its path misses Earth's centre: it grazes.
    expect(contact?.center[0]).toBeGreaterThan(1);
  });

  it('shears Theia into the debris within the hour', () => {
    const half = theiaAt(HOUR / 2);
    expect(half?.opacity).toBeGreaterThan(0);
    expect(half?.opacity).toBeLessThan(1);
    expect(half?.scale).toBeLessThan(1);
    expect(theiaAt(HOUR)).toBeNull();
  });

  it('flashes where it strikes, brightest in the first minutes, gone in half a day', () => {
    expect(flashAt(-1)).toBeNull();
    const early = flashAt(5 * 60);
    expect(early?.glow).toBeCloseTo(1);
    expect(length(early?.place ?? [0, 0, 0])).toBeCloseTo(Math.cbrt(0.89));
    expect(flashAt(6 * HOUR)?.glow).toBeLessThan(0.5);
    expect(flashAt(13 * HOUR)).toBeNull();
    expect(flashAt(30 * 60)?.size).toBeGreaterThan(flashAt(60)?.size ?? Infinity);
  });

  it('throws half the debris inside the Roche limit and half beyond, the same each time', () => {
    const made = pieces(200);
    expect(made).toEqual(pieces(200));
    expect(made.filter((piece) => piece.fate === 'moon')).toHaveLength(100);
    for (const piece of made) {
      expect(piece.r).toBeGreaterThan(1);
      expect(piece.fate === 'moon' ? piece.r >= ROCHE : piece.r < ROCHE).toBe(true);
    }
  });

  it('sends the debris out from the strike into an arm, settled in the disc within a day', () => {
    const [piece] = pieces(1);
    if (piece === undefined) throw new Error('no piece');
    expect(pieceAt(piece, -1, 0)).toBeNull();
    const first = pieceAt(piece, 60, 0);
    // Still at the strike, on Earth's surface.
    expect(length(first?.place ?? [0, 0, 0])).toBeCloseTo(1.02, 1);
    const thrown = pieceAt(piece, 2 * HOUR, 0);
    expect(length(thrown?.place ?? [0, 0, 0])).toBeGreaterThan(1.5);
    const settled = pieceAt(piece, DAY, 0);
    const [x, , z] = settled?.place ?? [0, 0, 0];
    expect(Math.hypot(x, z)).toBeCloseTo(piece.r, 1);
    expect(settled?.heat).toBeLessThan(1);
  });

  it('gathers the outer debris into the Moon within a year, and clears the inner within a century', () => {
    const made = pieces(40);
    const shown = (seconds: number): number =>
      made.filter((piece) => pieceAt(piece, seconds, 0) !== null).length;
    expect(shown(DAY)).toBe(40);
    expect(shown(2 * YEAR)).toBe(20);
    expect(shown(101 * YEAR)).toBe(0);
  });

  it('grows the Moon just outside the Roche limit, molten, cooling over ten million years', () => {
    expect(moonAt(HOUR, 0)).toBeNull();
    const young = moonAt(30 * DAY, 0);
    const whole = moonAt(200 * YEAR, 0);
    expect(young?.radius).toBeLessThan(whole?.radius ?? 0);
    expect(whole?.radius).toBeCloseTo(MOON_RADIUS);
    expect(length(whole?.place ?? [0, 0, 0])).toBeCloseTo(MOON_ORBIT);
    expect(whole?.heat).toBe(1);
    expect(moonAt(1e7 * YEAR, 0)?.heat).toBe(0);
  });

  it('turns the disc and the Moon with the time played, faster further in', () => {
    expect(turned(1.5, 1)).toBeGreaterThan(turned(MOON_ORBIT, 1));
    expect(turned(2, 0)).toBe(0);
    const still = moonAt(YEAR, 0)?.place;
    const later = moonAt(YEAR, 4)?.place;
    expect(later).not.toEqual(still);
    expect(onDisc(2, STRIKE_ANGLE)[1]).toBe(0);
  });

  it('colours heat from white-hot to dull red, and the Moon from orange to grey', () => {
    const [r, g, b] = glowColour(1);
    expect(Math.min(r, g, b)).toBeGreaterThan(0.6);
    const [, coolG, coolB] = glowColour(0);
    expect(coolG).toBeLessThan(0.2);
    expect(coolB).toBeLessThan(0.1);
    const [mr, mg, mb] = moonColour(0);
    expect(mr).toBeCloseTo(mg);
    expect(mg).toBeCloseTo(mb);
    expect(moonColour(1)[0]).toBeGreaterThan(moonColour(1)[2]);
  });

  it('draws each scenario’s hit: the half-Earths larger and slower, the fast spinner small and fast (#1220)', () => {
    const half = THEIA_CHOICES.halfEarths.hit;
    const spin = THEIA_CHOICES.fastSpin.hit;
    expect(theiaAt(0, half)?.scale).toBeGreaterThan(theiaAt(0)?.scale ?? Infinity);
    expect(theiaAt(0, spin)?.scale).toBeLessThan(1);
    // Contact at the sum of the two bodies' radii, the proto-Earth half of today's.
    expect(length(theiaAt(0, half)?.center ?? [0, 0, 0])).toBeCloseTo(
      Math.cbrt(half.protoEarth) + half.radius,
    );
    const out = (hit: typeof spin): number => length(theiaAt(-HOUR, hit)?.center ?? [0, 0, 0]);
    expect(out(spin)).toBeGreaterThan(out(THEIA_CHOICES.canonical.hit));
    expect(strikeAngle(spin)).not.toBeCloseTo(strikeAngle());
    expect(length(flashAt(60, half)?.place ?? [0, 0, 0])).toBeCloseTo(Math.cbrt(half.protoEarth));
  });

  it('throws the Moon straight into a wide orbit within hours when it forms at once (#1220)', () => {
    const hit = THEIA_CHOICES.immediate.hit;
    expect(moonAt(2 * HOUR, 0, hit)).toBeNull();
    const formed = moonAt(DAY, 0, hit);
    expect(length(formed?.place ?? [0, 0, 0])).toBeCloseTo(IMMEDIATE_ORBIT);
    expect(formed?.radius).toBeGreaterThan(0.95 * MOON_RADIUS);
    // The outer debris is in it within half a day; the rest clears within a year.
    const made = pieces(40);
    const shown = (seconds: number): number =>
      made.filter((piece) => pieceAt(piece, seconds, 0, hit) !== null).length;
    expect(shown(13 * HOUR)).toBe(20);
    expect(shown(2 * YEAR)).toBe(0);
  });
});
