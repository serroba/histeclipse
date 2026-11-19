import { describe, expect, it } from 'vitest';

import rocksFile from '../../../public/data/rocks.json';
import { loadRocks, rockUnits } from '../../data/rocks';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { hereVersion, hereView, whyMoment, whyVersion, type HereData } from './facts';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));

const base = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const athens = { latitude: 37.97, longitude: 23.72 };
const nothing: HereData = { drawn: null, rocks: null, features: [] };
const here: ViewState = { ...base, location: athens };

describe('hereView', () => {
  it('says nothing with no place picked, or in deep time', () => {
    expect(hereView(base, nothing)).toBeNull();
    expect(hereView({ ...here, ma: 100 }, nothing)).toBeNull();
  });

  it('names the place picked, with what its layers have there', () => {
    const view = hereView(here, nothing);
    expect(view?.place).toBe('38.0°N 23.7°E');
    expect(Array.isArray(view?.facts)).toBe(true);
  });

  it('asks the borders drawn for the year shown, once states are on', () => {
    const states = { ...here, layers: withLayer(here.layers, 'empires', true) };
    const drawnThen = { year: 2026, territories: [] };
    expect(hereView(states, { ...nothing, drawn: drawnThen })).not.toBeNull();
    // Borders drawn for another year say nothing of this one.
    expect(hereView(states, { ...nothing, drawn: { year: 1900, territories: [] } })).not.toBeNull();
    // Long ago, the states are as of the nearest year the borders reach.
    const ancient: ViewState = {
      ...states,
      time: { ...states.time, date: { ...states.time.date, year: astronomicalYear(-5000) } },
    };
    expect(hereView(ancient, nothing)).not.toBeNull();
  });

  it('reads the rock at the place, once it is in and on', async () => {
    const rocks = await loadRocks('rocks', serve(rocksFile));
    const on = { ...here, layers: withLayer(here.layers, 'rocks', true) };
    const loaded: HereData = { drawn: null, rocks: rockUnits(rocks), features: [] };
    const both = hereView(on, loaded);
    expect(both?.facts.length).toBeGreaterThan(0);
    expect(hereView(on, nothing)).not.toEqual(both);
    expect(hereVersion(on, loaded)).not.toBe(hereVersion(on, nothing));
  });

  it('adds what the features have at the place, and is written again when that changes (#893)', () => {
    const fact = { title: 'El Niño and La Niña', text: 'Wetter.', why: 'enso' } as const;
    const withFact: HereData = { ...nothing, features: [['enso', fact]] };
    expect(hereView(here, withFact)?.facts).toContainEqual(fact);
    expect(hereVersion(here, withFact)).not.toBe(hereVersion(here, nothing));
  });

  it('keeps the ways of life before the rock, and the other features after it (#909)', async () => {
    const rocks = await loadRocks('rocks', serve(rocksFile));
    const on = { ...here, layers: withLayer(here.layers, 'rocks', true) };
    const enso = { title: 'El Niño and La Niña', text: 'Wetter.', why: 'enso' } as const;
    const ways = { title: 'Ways of life', text: 'Farming.', why: 'ways' } as const;
    const view = hereView(on, {
      drawn: null,
      rocks: rockUnits(rocks),
      features: [
        ['enso', enso],
        ['ways', ways],
      ],
    });
    expect(view?.facts.map(({ title }) => title)).toEqual([
      'Ways of life',
      'Rocks',
      'El Niño and La Niña',
    ]);
  });
});

describe('hereVersion', () => {
  it('changes with the place, the year, the layers and what has loaded', () => {
    const before = hereVersion(here, nothing);
    expect(hereVersion({ ...here, location: { latitude: 0, longitude: 0 } }, nothing)).not.toBe(
      before,
    );
    expect(hereVersion(here, { ...nothing, drawn: { year: 2026, territories: [] } })).not.toBe(
      before,
    );
    expect(hereVersion(base, nothing)).not.toBe(before);
  });
});

describe('whyMoment', () => {
  it("says the period's evidence for deep time's map, and nothing else", () => {
    expect(whyMoment('deep-evidence', base)).toBeNull();
    expect(whyMoment('tree', { ...base, ma: 150 })).toBeNull();
    const jurassic = whyMoment('deep-evidence', { ...base, ma: 150 });
    expect(jurassic?.title).toBe('Then: the Jurassic');
    expect(jurassic?.lines).toHaveLength(2);
    // Before the Earth, no period, and so nothing to say.
    expect(whyMoment('deep-evidence', { ...base, ma: 10_000 })).toBeNull();
  });
});

describe('whyVersion', () => {
  it('follows "Here" and deep time\'s period, and is empty for every other why', () => {
    expect(whyVersion({ ...here, why: 'here' }, () => nothing)).toBe(hereVersion(here, nothing));
    expect(whyVersion({ ...base, why: 'deep-evidence', ma: 150 }, () => nothing)).toBe('Jurassic');
    expect(whyVersion({ ...base, why: 'deep-evidence' }, () => nothing)).toBe('');
    expect(whyVersion({ ...base, why: 'ways' }, () => nothing)).toBe('');
  });
});
