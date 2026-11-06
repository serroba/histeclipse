import { describe, expect, it } from 'vitest';

import { withLayer, type Layer } from './viewState';

describe('withLayer', () => {
  const layers = (...names: Layer[]) => new Set<Layer>(names);

  it('turns a layer on or off', () => {
    expect([...withLayer(layers('lunar'), 'empires', true)]).toEqual(['lunar', 'empires']);
    expect([...withLayer(layers('lunar', 'empires'), 'empires', false)]).toEqual(['lunar']);
  });

  it('keeps one ground fill at a time: rocks or ways of life', () => {
    expect([...withLayer(layers('empires', 'rocks'), 'ways', true)]).toEqual(['empires', 'ways']);
    expect([...withLayer(layers('ways'), 'rocks', true)]).toEqual(['rocks']);
    expect([...withLayer(layers('rocks', 'ways'), 'ways', false)]).toEqual(['rocks']);
  });
});
