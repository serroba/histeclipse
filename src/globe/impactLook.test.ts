import { describe, expect, it } from 'vitest';

import { APPROACH_SECONDS } from '../deepTime/strikeClock';
import { illustratedEnd, illustratedLook, strikeLook } from './impactLook';
import { APPROACH, impactSizes } from './impactSizes';

const HOUR = 3600;
const YEAR = 365.25 * 86_400;

describe('the short illustration, in its own milliseconds (#314, #1167)', () => {
  const sizes = impactSizes(180, 1);

  it('comes in, flashes, spreads, leaves its crater, and ends', () => {
    expect(illustratedLook(0, sizes).falling).toBe(0);
    expect(illustratedLook(0, sizes).flashing).toBeNull();
    const struck = illustratedLook(APPROACH + 100, sizes);
    expect(struck.falling).toBe(1);
    expect(struck.flashing).toBeGreaterThan(0);
    expect(struck.spreading).toBeGreaterThan(0);
    expect(struck.shell.visible).toBe(true);
    const later = illustratedLook(APPROACH + 4000, sizes);
    expect(later.flashing).toBeNull();
    expect(later.spreading).toBeNull();
    expect(later.crater).toBeGreaterThan(0.9);
    expect(illustratedLook(illustratedEnd(sizes), sizes).crater).toBe(0);
  });

  it('plays a smaller impact sooner', () => {
    expect(illustratedEnd(impactSizes(24))).toBeLessThan(illustratedEnd(sizes));
  });
});

describe('the strike in its own time, from the strike clock (#1173)', () => {
  it('comes in over the approach, unstruck until the strike', () => {
    const coming = strikeLook(-APPROACH_SECONDS / 2, 1);
    expect(coming.falling).toBeCloseTo(0.5, 6);
    expect(coming.flashing).toBeNull();
    expect(coming.shell.visible).toBe(false);
    expect(strikeLook(-APPROACH_SECONDS * 2, 1).falling).toBe(0);
  });

  it('flashes in the first minute, spreads its blast for ten, and leaves its crater', () => {
    expect(strikeLook(10, 1).flashing).toBeGreaterThan(0);
    expect(strikeLook(90, 1).flashing).toBeNull();
    expect(strikeLook(90, 1).spreading).toBeGreaterThan(0);
    expect(strikeLook(900, 1).spreading).toBeNull();
    expect(strikeLook(30, 1).crater).toBe(0);
    expect(strikeLook(HOUR, 1).crater).toBe(1);
    expect(strikeLook(1e6 * YEAR, 1).crater).toBe(1);
  });

  it('sends the ejecta round the globe in hours, glowing, then veils it for years and clears', () => {
    expect(strikeLook(30 * 60, 1).shell.front).toBeGreaterThan(0);
    expect(strikeLook(8 * HOUR, 1).shell.front).toBeCloseTo(Math.PI, 6);
    expect(strikeLook(8 * HOUR, 1).shell.frontGlow).toBe(0);
    expect(strikeLook(2 * HOUR, 1).shell.ember).toBe(1);
    expect(strikeLook(10 * 86_400, 1).shell.ember).toBe(0);
    expect(strikeLook(YEAR, 1).shell.veil).toBeCloseTo(0.8, 6);
    expect(strikeLook(10 * YEAR, 1).shell.veil).toBeGreaterThan(0);
    expect(strikeLook(100 * YEAR, 1).shell.veil).toBe(0);
  });

  it('reaches only part of the way round for a smaller impact, and shows no shell for a regional one', () => {
    expect(strikeLook(8 * HOUR, 0.5).shell.front).toBeCloseTo(Math.PI / 2, 6);
    expect(strikeLook(8 * HOUR, 0).shell.visible).toBe(false);
  });
});
