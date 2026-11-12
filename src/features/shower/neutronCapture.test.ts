import { describe, expect, it } from 'vitest';

import {
  capture,
  element,
  makeUp,
  nuclearRadius,
  PROTON_MEV,
  Q_MEV,
  REACTION_FACTS,
  RECOIL_MEV,
} from './neutronCapture';

describe('the energy given off', () => {
  it('is 0.626 MeV, from the masses, shared 14 to 1 between the proton and the carbon-14', () => {
    expect(Q_MEV).toBeCloseTo(0.6259, 4);
    expect(PROTON_MEV + RECOIL_MEV).toBeCloseTo(Q_MEV, 12);
    expect(PROTON_MEV / RECOIL_MEV).toBeCloseTo(14, 9);
    expect(PROTON_MEV).toBeCloseTo(0.584, 3);
  });
});

describe('capture', () => {
  const { slots, arrives, leaves } = capture();

  it('holds nitrogen-15’s fifteen places: 7 protons and 8 neutrons', () => {
    expect(slots).toHaveLength(15);
    expect(slots.filter(({ kind }) => kind === 'proton')).toHaveLength(7);
    expect(slots.filter(({ kind }) => kind === 'neutron')).toHaveLength(8);
  });

  it('fits them in a nucleus of its size', () => {
    for (const { at } of slots) expect(Math.hypot(...at)).toBeLessThan(nuclearRadius(15));
  });

  it('brings the neutron in on the left and lets a proton go on the right', () => {
    expect(slots[arrives]?.kind).toBe('neutron');
    expect(slots[leaves]?.kind).toBe('proton');
    const xs = slots.map(({ at }) => at[0]);
    expect(slots[arrives]?.at[0]).toBe(
      Math.min(...xs.filter((_, i) => slots[i]?.kind === 'neutron')),
    );
    expect(slots[leaves]?.at[0]).toBe(
      Math.max(...xs.filter((_, i) => slots[i]?.kind === 'proton')),
    );
  });

  it('is the same every time', () => {
    expect(capture()).toEqual(capture());
  });
});

describe('makeUp', () => {
  it('counts a neutron in, then a proton out: nitrogen-14 to carbon-14', () => {
    expect(makeUp('nitrogen')).toEqual({ protons: 7, neutrons: 7 });
    expect(makeUp('compound')).toEqual({ protons: 7, neutrons: 8 });
    expect(makeUp('carbon')).toEqual({ protons: 6, neutrons: 8 });
    expect(element(makeUp('nitrogen').protons)).toBe('nitrogen');
    expect(element(makeUp('compound').protons)).toBe('nitrogen');
    expect(element(makeUp('carbon').protons)).toBe('carbon');
    expect(element(8)).toBe('element 8');
  });
});

describe('REACTION_FACTS', () => {
  it('says the numbers the reaction is drawn by', () => {
    expect(REACTION_FACTS).toEqual([
      'n + ¹⁴N → ¹⁴C + p',
      'Nitrogen-14: 7 protons, 7 neutrons',
      'Carbon-14: 6 protons, 8 neutrons. One proton fewer makes it carbon; two neutrons more than common carbon-12 make it unstable',
      'It gives off 0.63 MeV: the proton flies off with 0.58, the carbon-14 recoils with 0.04',
      'The nucleus, about 6 fm across (6 × 10⁻¹⁵ m)',
    ]);
  });
});
