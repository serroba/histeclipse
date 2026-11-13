import { describe, expect, it } from 'vitest';

import { PLATES_CHIP, platesChip } from './platesChip';

describe('the plates’ chip', () => {
  it('turns the plates layer on, its book labelled Plates', () => {
    expect(PLATES_CHIP).toMatchObject({ layer: 'plates', label: 'Plates', why: 'plates' });
    expect(PLATES_CHIP.whyLabel).toBeUndefined();
  });

  it('is offered on every span, with no note while off', () => {
    expect(platesChip(false, null)).toEqual({ offered: true, on: false, note: null });
  });

  it('shows the outline’s swatch and what is drawn, or that the outlines load', () => {
    expect(platesChip(true, null).note).toEqual([
      { key: 'plates-swatch' },
      ' ',
      'Loading the continent outlines…',
    ]);
    expect(platesChip(true, 'Cao et al. 2024').note).toEqual([
      { key: 'plates-swatch' },
      ' ',
      'Cao et al. 2024',
    ]);
  });
});
