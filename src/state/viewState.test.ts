import { describe, expect, it } from 'vitest';

import {
  pinnedPlace,
  awayFromEarth,
  defaultViewState,
  layerTurned,
  tapClears,
  toggledLayer,
  withEclipse,
  withLayer,
  type Layer,
} from './viewState';

describe('withLayer', () => {
  const layers = (...names: Layer[]) => new Set<Layer>(names);

  it('turns a layer on or off', () => {
    expect([...withLayer(layers('eclipses'), 'empires', true)]).toEqual(['eclipses', 'empires']);
    expect([...withLayer(layers('eclipses', 'empires'), 'empires', false)]).toEqual(['eclipses']);
  });

  it('keeps one ground fill at a time: rocks, ways of life or radiocarbon dates', () => {
    expect([...withLayer(layers('empires', 'rocks'), 'ways', true)]).toEqual(['empires', 'ways']);
    expect([...withLayer(layers('ways'), 'rocks', true)]).toEqual(['rocks']);
    expect([...withLayer(layers('rocks', 'ways'), 'ways', false)]).toEqual(['rocks']);
    expect([...withLayer(layers('empires', 'ways'), 'dates', true)]).toEqual(['empires', 'dates']);
    expect([...withLayer(layers('dates', 'genomes'), 'rocks', true)]).toEqual(['genomes', 'rocks']);
  });
});

describe('toggledLayer', () => {
  it('Given a layer off, Then it turns on; given it on, Then it turns off', () => {
    const state = defaultViewState(new Date('2024-04-08T18:00:00Z'));
    const on = toggledLayer(state, 'orbits');
    expect(on.layers.has('orbits')).toBe(true);
    expect(toggledLayer(on, 'orbits').layers.has('orbits')).toBe(false);
  });

  it('Given an eclipse picked, When the eclipses go off, Then it is let go; on again, none is picked (#634)', () => {
    const state = defaultViewState(new Date('2024-04-08T18:00:00Z'));
    const picked = withEclipse(state, {
      kind: 'solar',
      date: { year: 2024, month: 4, day: 8, calendar: 'gregorian' },
    } as never);
    expect(picked.layers.has('eclipses')).toBe(true);
    const off = toggledLayer(picked, 'eclipses');
    expect(off.layers.has('eclipses')).toBe(false);
    expect(off.selection).toBeNull();
    expect(toggledLayer(off, 'eclipses').selection).toBeNull();
    // Another layer leaves the eclipse picked.
    expect(toggledLayer(picked, 'orbits').selection).toBe(picked.selection);
    // The same from the Layers panel, which says on or off rather than turning it over.
    expect(layerTurned(picked, 'eclipses', false).selection).toBeNull();
    expect(layerTurned(picked, 'eclipses', true).selection).toBe(picked.selection);
  });

  it('lets go of what the camera is on with the layer that holds it: a craft, or a telescope on the ground (#864)', () => {
    const base = defaultViewState(new Date(Date.UTC(2026, 0, 1)));
    const craft = { kind: 'craft', id: 'd01093' } as const;
    const site = { kind: 'site', id: 'lovell' } as const;
    const onCraft = { ...base, on: craft };
    const onSite = { ...base, on: site };
    expect(layerTurned(onCraft, 'spacecraft', false).on).toBeNull();
    expect(layerTurned(onCraft, 'telescopes', false).on).toBe(craft);
    expect(layerTurned(onSite, 'telescopes', false).on).toBeNull();
    expect(layerTurned(onSite, 'spacecraft', false).on).toBe(site);
    expect(layerTurned(onSite, 'telescopes', true).on).toBe(site);
    expect(layerTurned(base, 'telescopes', false).on).toBeNull();
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

describe('a tap on the globe (#811)', () => {
  it('clears the panels in deep time and in the ozone section, and picks a place elsewhere', () => {
    const base = defaultViewState(new Date('2024-04-08T12:00:00Z'));
    expect(tapClears(base)).toBe(false);
    expect(tapClears({ ...base, ma: 66 })).toBe(true);
    expect(tapClears({ ...base, layers: new Set<Layer>(['ozone']) })).toBe(true);
  });
});

describe('pinnedPlace (#948)', () => {
  it('Given a place, Then it is pinned in the years and not in deep time', () => {
    const place = { latitude: 38, longitude: 23.7 };
    const years = { ...defaultViewState(new Date('2026-01-01T00:00:00Z')), location: place };
    expect(pinnedPlace(years)).toEqual(place);
    expect(pinnedPlace({ ...years, ma: 540 })).toBeNull();
  });
});
