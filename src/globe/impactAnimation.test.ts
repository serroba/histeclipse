import { describe, expect, it } from 'vitest';

import { impactSizes } from './impactAnimation';

describe('an impact is drawn in proportion to its crater', () => {
  it('makes Chicxulub’s flash far larger than a small crater’s, and plays it longer', () => {
    const chicxulub = impactSizes(180);
    const middling = impactSizes(24);
    expect(chicxulub.strength).toBe(1);
    expect(chicxulub.flash / middling.flash).toBeCloseTo(180 / 24, 6);
    expect(chicxulub.head).toBeGreaterThan(middling.head);
    expect(chicxulub.trail).toBeGreaterThan(middling.trail);
    expect(chicxulub.totalMs).toBeGreaterThan(middling.totalMs);
  });

  it('keeps the smallest large enough to see, and caps the very largest', () => {
    const kaali = impactSizes(0.11);
    expect(kaali.flash).toBe(0.02);
    expect(kaali.blastRadius).toBe(0.015);
    expect(kaali.totalMs).toBeGreaterThan(2500);
    expect(impactSizes(400).strength).toBe(1.7);
    expect(impactSizes(300).totalMs).toBe(impactSizes(180).totalMs);
  });
});
