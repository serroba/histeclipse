import { describe, expect, it } from 'vitest';

import { ANOXIA_PATCHES } from './anoxicSeasPart';
import { ANOXIC_EXTENTS, coverOf, OCEAN_SHARE, PATCHES, patchesAt, scaleFor } from './anoxicExtent';

const KYR = 1000 * 365.25 * 86_400;
const PLACE = { latitude: 10, longitude: 120 };

describe('how much of the seafloor lost its oxygen (#1230)', () => {
  it('draws as many patches as the Earth shader holds', () => {
    expect(PATCHES).toBe(ANOXIA_PATCHES);
    expect(patchesAt(PLACE, 1)).toHaveLength(PATCHES);
  });

  it('grows the patches together, farther out and wider', () => {
    const [small, large] = [patchesAt(PLACE, 1), patchesAt(PLACE, 2)];
    expect(large[0]?.reach).toBe(2 * (small[0]?.reach ?? 0));
    expect(coverOf(large)).toBeGreaterThan(coverOf(small));
  });

  it('covers each published share of today’s seafloor, to within a percent of it', () => {
    for (const share of [0.078, 0.1, 0.15, 0.18]) {
      const drawn = coverOf(patchesAt(PLACE, scaleFor(PLACE, share))) / OCEAN_SHARE;
      expect(drawn, String(share)).toBeCloseTo(share, 2);
    }
  });

  it('works a share out once to the nearest half percent, and nothing for none', () => {
    expect(scaleFor(PLACE, 0.151)).toBe(scaleFor(PLACE, 0.15));
    expect(scaleFor(PLACE, 0)).toBeLessThan(0.01);
  });

  it('draws the end-Ordovician’s 15% and the Late Devonian’s 10% throughout', () => {
    expect(ANOXIC_EXTENTS['end-ordovician-extinction']?.share(0)).toBe(0.15);
    expect(ANOXIC_EXTENTS['late-devonian-extinction']?.share(500 * KYR)).toBe(0.1);
    expect(ANOXIC_EXTENTS['end-ordovician-extinction']?.says).toMatch(/Bartlett et al\. \(2018\)/);
    expect(ANOXIC_EXTENTS['late-devonian-extinction']?.says).toMatch(/White et al\. \(2018\)/);
  });

  it('draws the end-Permian’s rising to 18%, easing to 7.8%, and gone past its study', () => {
    const permian = ANOXIC_EXTENTS['end-permian-extinction'];
    const share = (kyr: number) => permian?.share(kyr * KYR) ?? -1;
    expect(permian?.site).toBe('meishan');
    expect(share(-10)).toBe(0);
    expect(share(61)).toBeCloseTo(0.18);
    expect(share(200)).toBeCloseTo(0.18);
    expect(share(1200)).toBeCloseTo(0.078);
    expect(share(1700)).toBeCloseTo(0.078);
    expect(share(2000)).toBeCloseTo(0);
  });

  it('draws the end-Triassic’s rising to 13% after the extinction, easing, and gone past its study', () => {
    const triassic = ANOXIC_EXTENTS['end-triassic-extinction'];
    const share = (kyr: number) => triassic?.share(kyr * KYR) ?? -1;
    expect(triassic?.site).toBe('kuhjoch');
    expect(share(-10)).toBe(0);
    expect(share(50)).toBeCloseTo(0.02);
    expect(share(225)).toBeCloseTo(0.13);
    expect(share(1000)).toBeGreaterThan(0.01);
    expect(share(1000)).toBeLessThan(0.06);
    expect(share(2100)).toBe(0);
    expect(triassic?.says).toMatch(/Somlyay et al\. \(2023\)/);
    expect(triassic?.says).toMatch(/Bond et al\. \(2023\)/);
  });
});
