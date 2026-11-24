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
    expect(marks.map((mark) => mark.site.id)).toEqual(['siberian-traps', 'norilsk', 'meishan']);
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
