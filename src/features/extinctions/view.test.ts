import { describe, expect, it } from 'vitest';

import sites from '../../../public/data/extinctions.json';
import type { ExtinctionSites } from '../../data/extinctions';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import {
  extinctionCard,
  extinctionMarks,
  extinctionMoments,
  extinctionsOn,
  extinctionsText,
  pickedMark,
  platesFact,
} from './view';

const DATA = sites as ExtinctionSites;
const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'extinctions', true), ma: 252 };

describe('the extinctions’ view', () => {
  it('draws in deep time, on the globe, on the plates’ span only', () => {
    expect(extinctionsOn(on)).toBe(true);
    expect(extinctionsOn({ ...on, layers: off.layers })).toBe(false);
    expect(extinctionsOn({ ...on, ma: null })).toBe(false);
    expect(extinctionsOn({ ...on, deepScale: 'eons' })).toBe(false);
    expect(extinctionsOn({ ...on, mode: 'sky' })).toBe(false);
  });

  it('marks the places of the extinctions near the moment, where the plates had them', () => {
    const marks = extinctionMarks(DATA, 252);
    expect(marks.map((mark) => mark.site.id)).toEqual([
      'siberian-traps',
      'norilsk',
      'meishan',
      'lootsberg',
      'frazer-beach',
    ]);
    const siberia = marks.find((mark) => mark.site.id === 'siberian-traps');
    // Siberia lay further south then, short of the Arctic Circle.
    expect(siberia?.point.latitude).toBeGreaterThan(50);
    expect(siberia?.point.latitude).toBeLessThan(62);
    expect(extinctionMarks(DATA, 300)).toEqual([]);
  });

  it('says which extinctions are near, or that none is', () => {
    expect(extinctionsText(extinctionMarks(DATA, 66))).toBe('End-Cretaceous extinction');
    expect(extinctionsText(extinctionMarks(DATA, 255))).toBe(
      'End-Guadalupian extinction · End-Permian mass extinction',
    );
    expect(extinctionsText([])).toBe('No great extinction near this moment.');
  });

  it('says where the two plate models put a place at its extinction, and how far apart (#1231)', () => {
    const [siberia] = extinctionMarks(DATA, 252);
    if (siberia === undefined) throw new Error('no Siberian Traps');
    const fact = platesFact(DATA, siberia.site, siberia.extinction);
    expect(fact).toMatch(/^PALEOMAP \(Scotese\), the deep-time maps’ model, puts it at 55\.\d°N/);
    expect(fact).toContain('Merdith et al. 2021 at 64.1°N 36.4°E');
    expect(fact).toMatch(/, 9\d0 km away and 8\.\d° apart in latitude\./);
    const card = extinctionCard(siberia, null, fact);
    expect(card.facts.at(-1)).toEqual(['Plates', fact]);
    expect(card.links.map((link) => link.label)).toContain('Merdith et al. 2021');
    expect(extinctionCard(siberia).facts.map(([label]) => label)).not.toContain('Plates');
    // No plate under it on the second model: nothing to compare.
    const offPlate = { ...siberia.site, other: null };
    expect(platesFact(DATA, offPlate, siberia.extinction)).toBeNull();
    // Nor where the maps' model has none then.
    const unplaced = { ...siberia.site, then: siberia.site.then.map(() => null) };
    expect(platesFact(DATA, unplaced, siberia.extinction)).toBeNull();
  });

  it('says what a record site shows, with its source, where there is more to say (#1232)', () => {
    const karoo = pickedMark(extinctionMarks(DATA, 252), 'lootsberg');
    if (karoo === undefined) throw new Error('no Karoo');
    const card = extinctionCard(karoo);
    expect(card.facts[1]?.[0]).toBe('Shows');
    expect(card.facts[1]?.[1]).toContain('more than 300,000 years before the sea’s');
    expect(card.links[0]?.label).toBe('Gastaldo et al. 2020');
    const meishan = pickedMark(extinctionMarks(DATA, 252), 'meishan');
    expect(meishan && extinctionCard(meishan).facts.map(([label]) => label)).not.toContain('Shows');
  });

  it('eases play near every extinction', () => {
    expect(extinctionMoments()).toEqual([444, 372.2, 259.8, 251.9, 201.5, 66]);
  });

  it('opens a place’s card with what it is, the dates, the losses and the causes', () => {
    const marks = extinctionMarks(DATA, 252);
    const norilsk = pickedMark(marks, 'norilsk');
    if (norilsk === undefined) throw new Error('no Norilsk');
    const card = extinctionCard(norilsk);
    expect(card.title).toBe('End-Permian mass extinction');
    expect(card.facts[0]).toEqual([
      'Here',
      'Siberian Traps, Norilsk: its cause, or one held or argued',
    ]);
    expect(card.facts[1]?.[1]).toContain('251.978–251.849 Ma');
    expect(card.links.map((link) => link.label)).toContain('Svensen et al. 2009');
    expect(card.note).toMatch(/^The usual “Big Five”/);
    expect(pickedMark(marks, 'chicxulub')).toBeUndefined();
  });

  it('says where it is dated, and calls the end-Guadalupian argued, with an age of its own', () => {
    const marks = extinctionMarks(DATA, 259.8);
    const meishan = pickedMark(extinctionMarks(DATA, 252), 'meishan');
    const emeishan = pickedMark(marks, 'emeishan-traps');
    if (meishan === undefined || emeishan === undefined) throw new Error('missing');
    expect(extinctionCard(meishan).facts[0]?.[1]).toBe('Meishan, China: where it is dated');
    const card = extinctionCard(emeishan);
    expect(card.facts[1]).toEqual(['When', 'About 259.8 million years ago']);
    expect(card.note).toMatch(/^Not one of the usual five\./);
  });
});
