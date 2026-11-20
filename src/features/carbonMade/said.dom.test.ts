// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { THEN_UNKNOWN, thenField, type CarbonMade } from './carbonMadeCard';
import { carbonMadeNote } from './said';

const sun = { id: 'average', label: 'Average Sun', note: '' } as unknown as CarbonMade['sun'];
const made = (field: CarbonMade['field']): CarbonMade => ({ field, sun, profile: [] });
const picked = { id: 'none', label: 'No', dipole: 0, note: '' } as CarbonMade['field'];

describe('what the Layers panel says of where carbon-14 is made', () => {
  it('names the field and Sun picked, in the years', () => {
    expect(carbonMadeNote(made(picked), false)).toBe(
      'No field, average sun: most is made over the poles.',
    );
  });

  it('says in deep time that a field picked is not the moment’s', () => {
    expect(carbonMadeNote(made(picked), true)).toBe(
      'Drawn for the field picked (no), not that of the moment shown.',
    );
  });

  it('says so while the field of the moment is not known', () => {
    expect(carbonMadeNote(made(THEN_UNKNOWN), false)).toBe(
      'The field at the moment shown is not known yet; today’s is drawn, average sun.',
    );
  });

  it('gives the strength of the field of the moment, and what a weak one means', () => {
    expect(carbonMadeNote(made(thenField(8.2)), false)).toBe(
      'The field at the moment shown, 8.2 × 10²² A m² (GGF100k), average sun: most is made over the poles.',
    );
    expect(carbonMadeNote(made(thenField(2.5)), false)).toMatch(
      /^The field at the moment shown is weak, 2\.5 × 10²² A m² \(GGF100k; today’s is 7\.8\)/,
    );
  });
});
