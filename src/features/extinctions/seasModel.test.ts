import { describe, expect, it } from 'vitest';

import { devonianSeas, ordovicianSeas } from './seasModel';

const KYR = 1000 * 365.25 * 86_400;

describe('the cold and the suffocating seas (#1202)', () => {
  it('the end-Ordovician: ice already, growing to its greatest with the first pulse, then melting', () => {
    expect(ordovicianSeas(-800 * KYR)).toEqual({ ice: 14, anoxia: 0 });
    expect(ordovicianSeas(0).ice).toBe(30);
    expect(ordovicianSeas(400 * KYR).ice).toBe(30);
    expect(ordovicianSeas(1000 * KYR).ice).toBe(6);
  });

  it('the end-Ordovician: oxygen-poor water with the second pulse, a million years on', () => {
    expect(ordovicianSeas(0).anoxia).toBe(0);
    expect(ordovicianSeas(1100 * KYR).anoxia).toBe(1);
    expect(ordovicianSeas(2000 * KYR).anoxia).toBe(0);
  });

  it('the Late Devonian: no ice, and two pulses of oxygen-poor water 600,000 years apart', () => {
    expect(devonianSeas(-100 * KYR)).toEqual({ ice: 0, anoxia: 0 });
    expect(devonianSeas(50 * KYR).anoxia).toBe(1);
    expect(devonianSeas(400 * KYR).anoxia).toBe(0);
    expect(devonianSeas(650 * KYR).anoxia).toBe(1);
    expect(devonianSeas(1200 * KYR).anoxia).toBe(0);
  });
});
