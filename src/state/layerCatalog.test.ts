import { describe, expect, it } from 'vitest';

import { HISTORY_LAYER_GROUPS, layerNote } from './layerCatalog';
import { LAYERS } from './viewState';

describe('the historical layers', () => {
  it('offers each layer once, and only layers the view knows', () => {
    const ids = HISTORY_LAYER_GROUPS.flatMap((group) => group.layers.map((layer) => layer.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(LAYERS).toContain(id);
  });

  it('says when the borders begin, by their source', () => {
    expect(layerNote('empires', -4999, 'cliopatria')).toBe(
      'Nothing to draw yet: Cliopatria begins in 3400 BCE.',
    );
    expect(layerNote('empires', -3500, 'cliopatria')).not.toBeNull();
    expect(layerNote('empires', -3500, 'ohm')).toBeNull();
    // Comparing both, the earlier source decides.
    expect(layerNote('empires', -3500, 'both')).toBeNull();
    expect(layerNote('empires', -4500, 'both')).toBe(
      'Nothing to draw yet: OpenHistoricalMap begins in 4001 BCE.',
    );
  });

  it('says when the borders end', () => {
    expect(layerNote('empires', 2026, 'cliopatria')).toBe(
      'Nothing to draw: Cliopatria ends in 2024 CE.',
    );
    expect(layerNote('empires', 2024, 'cliopatria')).toBeNull();
    expect(layerNote('empires', 2026, 'both')).toBeNull();
  });

  it('has nothing to say for layers drawn at any time', () => {
    expect(layerNote('solar', -9000, 'cliopatria')).toBeNull();
  });
});
