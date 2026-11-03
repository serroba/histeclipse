import { describe, expect, it } from 'vitest';

import { cliopatriaYear, HISTORY_LAYER_GROUPS, layerNote } from './layerCatalog';
import { LAYERS } from './viewState';

describe('the historical layers', () => {
  it('offers each layer once, and only layers the view knows', () => {
    const ids = HISTORY_LAYER_GROUPS.flatMap((group) => group.layers.map((layer) => layer.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(LAYERS).toContain(id);
  });

  it('says when the borders begin, by their source', () => {
    expect(layerNote('empires', -4999, 'cliopatria', 2026)).toBe(
      'Nothing to draw yet: Cliopatria begins in 3400 BCE.',
    );
    expect(layerNote('empires', -3500, 'cliopatria', 2026)).not.toBeNull();
    expect(layerNote('empires', -3500, 'ohm', 2026)).toBeNull();
    // Comparing both, the earlier source decides.
    expect(layerNote('empires', -3500, 'both', 2026)).toBeNull();
    expect(layerNote('empires', -4500, 'both', 2026)).toBe(
      'Nothing to draw yet: OpenHistoricalMap begins in 4001 BCE.',
    );
  });

  it('says when the borders end', () => {
    expect(layerNote('empires', 2027, 'cliopatria', 2026)).toBe(
      'Nothing to draw: Cliopatria ends in 2024 CE.',
    );
    expect(layerNote('empires', 2024, 'cliopatria', 2026)).toBeNull();
    expect(layerNote('empires', 2100, 'both', 2026)).toBe(
      'Nothing to draw: OpenHistoricalMap ends in 2099 CE.',
    );
    expect(layerNote('empires', 2050, 'both', 2026)).toBeNull();
    expect(layerNote('empires', 2050, 'ohm', 2026)).toBeNull();
  });

  it('carries Cliopatria’s latest borders on to the present, and says so', () => {
    expect(cliopatriaYear(2023, 2026)).toBe(2023);
    expect(cliopatriaYear(2026, 2026)).toBe(2024);
    expect(cliopatriaYear(2027, 2026)).toBe(2027);
    const note = 'Borders as of 2024 CE, Cliopatria’s latest year.';
    expect(layerNote('empires', 2025, 'cliopatria', 2026)).toBe(note);
    expect(layerNote('empires', 2026, 'both', 2026)).toBe(note);
    expect(layerNote('empires', 2026, 'ohm', 2026)).toBeNull();
  });

  it('has nothing to say for layers drawn at any time', () => {
    expect(layerNote('solar', -9000, 'cliopatria', 2026)).toBeNull();
  });
});
