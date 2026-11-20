import { describe, expect, it } from 'vitest';

import { defaultViewState, type ViewState } from '../../state/viewState';
import { hereVersion, hereView, whyMoment, whyVersion, type HereData } from './facts';

const base = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const athens = { latitude: 37.97, longitude: 23.72 };
const nothing: HereData = { features: [] };
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

  it('adds what the features have at the place, and is written again when that changes (#893)', () => {
    const fact = { title: 'El Niño and La Niña', text: 'Wetter.', why: 'enso' } as const;
    const withFact: HereData = { ...nothing, features: [['enso', fact]] };
    expect(hereView(here, withFact)?.facts).toContainEqual(fact);
    expect(hereVersion(here, withFact)).not.toBe(hereVersion(here, nothing));
  });

  it('lists the facts in the layers’ own order, whatever order the features come in (#909)', () => {
    const states = { title: 'States', text: 'Greece.', why: 'empires-cliopatria' } as const;
    const names = { title: 'States', text: 'By name.', why: 'empires-ohm' } as const;
    const enso = { title: 'El Niño and La Niña', text: 'Wetter.', why: 'enso' } as const;
    const ways = { title: 'Ways of life', text: 'Farming.', why: 'ways' } as const;
    const rock = { title: 'Rocks', text: 'Limestone.', why: 'rocks' } as const;
    const telescope = { title: 'Telescopes', text: 'One here.', why: 'telescopes' } as const;
    const view = hereView(here, {
      features: [
        ['enso', enso],
        ['empires', states],
        ['empires', names],
        ['rocks', rock],
        ['telescopes', telescope],
        ['ways', ways],
      ],
    });
    // A layer's own facts keep the order it gave them in.
    expect(view?.facts.map(({ text }) => text)).toEqual([
      'One here.',
      'Greece.',
      'By name.',
      'Farming.',
      'Limestone.',
      'Wetter.',
    ]);
    expect(view?.facts.map(({ title }) => title)).toEqual([
      'Telescopes',
      'States',
      'States',
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
