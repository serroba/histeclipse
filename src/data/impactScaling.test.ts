import { describe, expect, it } from 'vitest';

import {
  approachOf,
  impactorDiameterKm,
  impactorText,
  transientDiameterKm,
  TYPICAL_IMPACT,
} from './impactScaling';

describe('the impactor a crater speaks of', () => {
  it('runs the transient crater back from the final one, simple or complex', () => {
    expect(transientDiameterKm(1.25)).toBeCloseTo(1);
    // Complex: Collins eq. 27 forwards gives the final crater back.
    const transient = transientDiameterKm(180);
    expect((1.17 * transient ** 1.13) / 3.2 ** 0.13).toBeCloseTo(180, 6);
  });

  it('puts Chicxulub’s impactor in the range the literature gives', () => {
    // Typical assumptions; studies give roughly 10 to 20 km.
    expect(impactorDiameterKm(180)).toBeGreaterThan(10);
    expect(impactorDiameterKm(180)).toBeLessThan(20);
  });

  it('grows with the crater, and shrinks for a faster or steeper strike', () => {
    expect(impactorDiameterKm(100)).toBeLessThan(impactorDiameterKm(180));
    expect(impactorDiameterKm(180, { ...TYPICAL_IMPACT, speedKmS: 25 })).toBeLessThan(
      impactorDiameterKm(180),
    );
    expect(impactorDiameterKm(180, { ...TYPICAL_IMPACT, angleDegrees: 90 })).toBeLessThan(
      impactorDiameterKm(180),
    );
  });

  it('takes Chicxulub’s approach from its study, and assumes the rest', () => {
    expect(approachOf('Chicxulub')).toEqual({ fromAzimuth: 45, angleDegrees: 60, studied: true });
    expect(approachOf('Popigai').studied).toBe(false);
  });

  it('says what is estimated and what assumed', () => {
    expect(impactorText('Chicxulub', 180)).toMatch(
      /^About 1\d km across, by the crater-scaling laws of Collins et al\. \(2005\).*60° from the north-east, as Collins et al\. \(2020\) found\. An estimate/,
    );
    expect(impactorText('Meteor Crater', 1.2)).toMatch(
      /^About \d+ m across.*assuming the most likely angle, 45°/,
    );
  });
});
