import { describe, expect, it } from 'vitest';

import { PLATES_CHIP, platesChip } from './platesChip';

describe('the plates’ chip', () => {
  it('turns the plates layer on, its book labelled Plates', () => {
    expect(PLATES_CHIP).toMatchObject({ label: 'Plates', why: 'plates' });
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

  it('keys the plate boundaries’ kinds while they are drawn (#1160)', () => {
    const note = platesChip(true, 'Cao et al. 2024', true).note ?? [];
    expect(note.slice(0, 3)).toEqual([{ key: 'plates-swatch' }, ' ', 'Cao et al. 2024']);
    const key = note[3];
    expect(key !== undefined && typeof key !== 'string' && 'list' in key ? key.list : []).toEqual([
      expect.objectContaining({
        parts: [{ key: 'boundary-swatch is-ridge' }, ' ', 'Ridges and rifts: plates part'],
      }),
      expect.objectContaining({
        parts: [
          { key: 'boundary-swatch is-subduction' },
          ' ',
          'Subduction zones: one sinks under another',
        ],
      }),
      expect.objectContaining({
        parts: [{ key: 'boundary-swatch is-transform' }, ' ', 'Transforms: plates slide past'],
      }),
      expect.objectContaining({
        parts: [{ key: 'boundary-swatch is-other' }, ' ', 'Other boundaries'],
      }),
    ]);
  });
});
