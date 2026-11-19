import { describe, expect, it } from 'vitest';

import { LAYER_GROUPS, LAYERS } from './layers';

describe('the layers', () => {
  const choices = LAYER_GROUPS.flatMap((group) => group.layers);

  it('offers each layer once in the Layers panel, and every layer there is', () => {
    const ids = choices.map((choice) => choice.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(LAYERS).size).toBe(LAYERS.length);
    expect([...ids].sort()).toEqual([...LAYERS].sort());
  });

  it('has each layer draw on a span of its own, and say what it is', () => {
    for (const choice of choices) {
      expect(choice.spans.length, choice.id).toBeGreaterThan(0);
      expect(choice.label, choice.id).not.toBe('');
      expect(choice.about, choice.id).not.toBe('');
      expect(choice.reach, choice.id).not.toBe('');
    }
  });

  it('keeps the order a link lists them in: links made before read the same', () => {
    expect(LAYERS.slice(0, 5)).toEqual([
      'eclipses',
      'orbits',
      'spacecraft',
      'asteroids',
      'telescopes',
    ]);
    expect(LAYERS.at(-1)).toBe('fossils');
  });
});
