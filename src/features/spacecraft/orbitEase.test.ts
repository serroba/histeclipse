import { describe, expect, it } from 'vitest';

import type { Craft } from '../../data/spacecraft';
import { lapDays } from './earthOrbit';
import { easedOrbits, MOST_LAP_A_FRAME } from './orbitEase';

const orbit = { perigeeKm: 611, apogeeKm: 620, inclinationDeg: 28.47, measured: '1990-05-24' };
const hubble = { id: 'S20580', orbit } as unknown as Craft;
const probe = { id: 'D00001' } as unknown as Craft;
const LAP = lapDays(orbit);

/** Fractional laps from the true moment, in (-½, ½]. */
function behind(shown: number, jd: number): number {
  const laps = (shown - jd) / LAP;
  return laps - Math.round(laps);
}

/** How much of a lap the dot has gone round between two moments it was drawn at, signed. */
function turned(shown: number, before: number): number {
  const laps = (shown - before) / LAP;
  return laps - Math.round(laps);
}

describe('a craft in orbit about Earth, played fast', () => {
  it('Given a craft with no orbit about Earth, Then its moment is the true one', () => {
    const eased = easedOrbits();
    expect(eased(probe, 100)).toBe(100);
    expect(eased(probe, 5000)).toBe(5000);
  });

  it('Given time moving slowly, Then its dot is where it truly is', () => {
    const eased = easedOrbits();
    let jd = 2_450_000;
    for (let frame = 0; frame < 20; frame += 1) {
      expect(eased(hubble, jd)).toBe(jd);
      jd += LAP * MOST_LAP_A_FRAME * 0.9;
    }
  });

  it('Given time moving many laps a frame, Then its dot goes round a calm fraction of a lap a frame, with time', () => {
    const eased = easedOrbits();
    let jd = 2_450_000;
    let before = eased(hubble, jd);
    for (let frame = 0; frame < 30; frame += 1) {
      jd += 0.83; // 50 days a second at 60 frames: about twelve laps a frame
      const shown = eased(hubble, jd);
      expect(turned(shown, before)).toBeCloseTo(MOST_LAP_A_FRAME, 6);
      before = shown;
    }
  });

  it('Given time played backwards fast, Then the dot goes round backwards', () => {
    const eased = easedOrbits();
    let jd = 2_450_000;
    let before = eased(hubble, jd);
    for (let frame = 0; frame < 5; frame += 1) {
      jd -= 0.83;
      const shown = eased(hubble, jd);
      expect(turned(shown, before)).toBeCloseTo(-MOST_LAP_A_FRAME, 6);
      before = shown;
    }
  });

  it('Given the dot eased, Then it is never more than half a lap from the true moment, so its plane is where time puts it', () => {
    const eased = easedOrbits();
    let jd = 2_450_000;
    for (let frame = 0; frame < 200; frame += 1) {
      jd += 0.83;
      expect(Math.abs(behind(eased(hubble, jd), jd))).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(Math.abs(eased(hubble, jd) - jd)).toBeLessThanOrEqual(LAP / 2 + 1e-9);
    }
  });

  it('Given a redraw at the same moment, Then it answers as before', () => {
    const eased = easedOrbits();
    eased(hubble, 2_450_000);
    const first = eased(hubble, 2_450_001);
    expect(eased(hubble, 2_450_001)).toBe(first);
  });

  it('Given time slowed again, Then it is back at where it truly is', () => {
    const eased = easedOrbits();
    eased(hubble, 2_450_000);
    eased(hubble, 2_450_001);
    expect(eased(hubble, 2_450_001 + LAP * MOST_LAP_A_FRAME * 0.5)).toBe(
      2_450_001 + LAP * MOST_LAP_A_FRAME * 0.5,
    );
  });
});
