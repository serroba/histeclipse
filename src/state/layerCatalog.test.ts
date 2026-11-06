import { describe, expect, it } from 'vitest';

import { cliopatriaYear, elsewhereNote, LAYER_GROUPS, layerNote } from './layerCatalog';
import { LAYERS } from './viewState';

describe('the layers', () => {
  it('offers each layer once, and only layers the view knows', () => {
    const ids = LAYER_GROUPS.flatMap((group) => group.layers.map((layer) => layer.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(LAYERS).toContain(id);
  });

  it('offers every layer, for all of time, each drawing on a span of its own', () => {
    const choices = LAYER_GROUPS.flatMap((group) => group.layers);
    expect(choices.map((choice) => choice.id).sort()).toEqual([...LAYERS].sort());
    for (const choice of choices) expect(choice.spans.length).toBeGreaterThan(0);
  });

  it('says, off its spans, where a layer draws and how far its data reaches', () => {
    const choices = LAYER_GROUPS.flatMap((group) => group.layers);
    const find = (id: string) => choices.find((choice) => choice.id === id);
    const fossils = find('fossils');
    const temperature = find('temperature');
    const impacts = find('impacts');
    if (fossils === undefined || temperature === undefined || impacts === undefined) {
      throw new Error('missing layer');
    }
    expect(elsewhereNote(fossils)).toBe(
      `Nothing here: drawn on the 540 Myr span. ${fossils.reach}`,
    );
    expect(elsewhereNote(temperature)).toMatch(
      /^Nothing here: drawn on the 540 Myr and 4\.6 Gyr spans\. /,
    );
    expect(elsewhereNote(impacts)).toMatch(/drawn on the Years, Ice ages and 540 Myr spans\./);
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
