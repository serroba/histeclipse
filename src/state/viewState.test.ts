import { describe, expect, it } from 'vitest';

import { awayFromEarth, defaultViewState, withLayer, type Layer } from './viewState';

describe('withLayer', () => {
  const layers = (...names: Layer[]) => new Set<Layer>(names);

  it('turns a layer on or off', () => {
    expect([...withLayer(layers('lunar'), 'empires', true)]).toEqual(['lunar', 'empires']);
    expect([...withLayer(layers('lunar', 'empires'), 'empires', false)]).toEqual(['lunar']);
  });

  it('keeps one ground fill at a time: rocks, ways of life or radiocarbon dates', () => {
    expect([...withLayer(layers('empires', 'rocks'), 'ways', true)]).toEqual(['empires', 'ways']);
    expect([...withLayer(layers('ways'), 'rocks', true)]).toEqual(['rocks']);
    expect([...withLayer(layers('rocks', 'ways'), 'ways', false)]).toEqual(['rocks']);
    expect([...withLayer(layers('empires', 'ways'), 'dates', true)]).toEqual(['empires', 'dates']);
    expect([...withLayer(layers('dates', 'genomes'), 'rocks', true)]).toEqual(['genomes', 'rocks']);
  });
});

describe('awayFromEarth', () => {
  const state = defaultViewState(new Date(Date.UTC(2024, 3, 8)));

  it('Given the globe on Mars in the years, Then the view is away from Earth', () => {
    expect(awayFromEarth({ ...state, mode: 'globe', focus: 'mars', ma: null })).toBe(true);
  });

  it('Given Earth, the sky, or deep time, Then it is not', () => {
    expect(awayFromEarth({ ...state, mode: 'globe', focus: 'earth', ma: null })).toBe(false);
    expect(awayFromEarth({ ...state, mode: 'sky', focus: 'mars', ma: null })).toBe(false);
    expect(awayFromEarth({ ...state, mode: 'globe', focus: 'mars', ma: 100 })).toBe(false);
  });
});
