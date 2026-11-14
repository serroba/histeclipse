import { describe, expect, it } from 'vitest';

import { activeLayers, spanShown } from './activeLayers';
import type { Layer } from './viewState';

const view = (layers: Layer[], ma: number | null, deepScale: 'ice' | 'all' | 'eons' = 'all') => ({
  layers: new Set(layers),
  ma,
  deepScale,
});

describe('the layers on', () => {
  it('Given no layers, Then there are no chips', () => {
    expect(activeLayers(view([], null))).toEqual([]);
  });

  it('Given layers on in the ice ages, Then each says whether it draws there, in the catalogue’s order', () => {
    const chips = activeLayers(view(['humans', 'genomes', 'plates'], 0.315, 'ice'));
    expect(chips.map((chip) => [chip.layer, chip.draws])).toEqual([
      ['genomes', false],
      ['plates', true],
      ['humans', true],
    ]);
    expect(chips[0]?.goTo).toEqual({ span: 'years', label: 'Years' });
    expect(chips[1]?.goTo).toBeNull();
  });

  it('Given a layer with a moment of its own off its span, Then going there lands on it', () => {
    const [humans] = activeLayers(view(['humans'], null));
    expect(humans?.draws).toBe(false);
    expect(humans?.goTo).toEqual({ span: 'ice', ma: 0.315, label: 'the earliest Homo sapiens' });
    expect(humans?.reach).toMatch(/hundred thousand years/);
  });

  it('Given the span shown, Then the years or the deep scale', () => {
    expect(spanShown({ ma: null, deepScale: 'eons' })).toBe('years');
    expect(spanShown({ ma: 3, deepScale: 'eons' })).toBe('eons');
  });
});
