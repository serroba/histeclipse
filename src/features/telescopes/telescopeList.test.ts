import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadTelescopes, type Telescope, type Telescopes } from '../../data/telescopes';
import { defaultViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import { bandsIn, goTo, goToCraft, listed, rowText, yearToShow } from './telescopeList';

const raw: unknown = JSON.parse(readFileSync('public/data/telescopes.json', 'utf8'));
const record: Telescopes = await loadTelescopes('t.json', () =>
  Promise.resolve(new Response(JSON.stringify(raw))),
);
const named = (id: string): Telescope => {
  const found = record.telescopes.find((telescope) => telescope.id === id);
  if (found === undefined) throw new Error(`no ${id}`);
  return found;
};
const in2026 = defaultViewState(new Date('2026-01-01T00:00:00Z'));

describe('the telescopes’ list (#850)', () => {
  it('keeps the record’s order, its ranking, Webb first', () => {
    const all = listed(record, { kind: 'all', band: null });
    expect(all).toHaveLength(record.telescopes.length);
    expect(all[0]?.id).toBe('webb');
  });

  it('filters to space or the ground, and to a band of light', () => {
    const ground = listed(record, { kind: 'ground', band: null });
    expect(ground.every((t) => t.kind === 'ground')).toBe(true);
    const xrays = listed(record, { kind: 'all', band: 'x-ray' });
    expect(xrays.map((t) => t.id)).toEqual(expect.arrayContaining(['chandra', 'xmm-newton']));
    expect(xrays.every((t) => t.bands.includes('x-ray'))).toBe(true);
    expect(listed(record, { kind: 'ground', band: 'x-ray' })).toEqual([]);
  });

  it('offers the bands the telescopes see, in the spectrum’s order', () => {
    expect(bandsIn(record)).toEqual([
      'radio',
      'microwave',
      'infrared',
      'optical',
      'ultraviolet',
      'x-ray',
      'gamma',
    ]);
  });

  it('says each in a line: size, what it sees, its years, where', () => {
    expect(rowText(named('arecibo'))).toEqual({
      title: 'Arecibo Telescope',
      meta: expect.stringMatching(/^305 m · radio · 1963–2020 · /) as string,
    });
    expect(rowText(named('webb')).meta).toMatch(/^6\.5 m · .* · 2021– · in space$/);
    expect(rowText(named('vla')).meta).toMatch(/^36 km across/);
    expect(rowText(named('elt')).meta).toContain('being built');
    expect(rowText(named('fermi')).meta).toMatch(/^gamma rays · 2008– · in space$/);
  });
});

describe('going to a telescope from the list', () => {
  it('turns its layer on, shuts the list, and puts the camera over its site', () => {
    const state = goTo({ ...in2026, list: 'telescopes' }, named('vlt'));
    expect(state.layers.has('telescopes')).toBe(true);
    expect(state.list).toBeNull();
    expect(state.focus).toBe('earth');
    expect(state.camera.target.latitude).toBeCloseTo(-24.63, 1);
    expect(state.time).toBe(in2026.time);
  });

  it('goes back to a year it worked if it was not working in the year shown', () => {
    expect(yearToShow(named('arecibo'), 2026)).toBe(1963);
    expect(yearToShow(named('arecibo'), 2000)).toBe(2000);
    const state = goTo(in2026, named('arecibo'));
    expect(state.time.date.year).toBe(1963);
    const before = { ...in2026, time: moveToYear(in2026.time, astronomicalYear(1990)) };
    expect(goTo(before, named('webb')).time.date.year).toBe(2021);
  });

  it('frames a space telescope by its orbit: Earth close, further out, or the Sun', () => {
    expect(goTo(in2026, named('hubble')).camera.distance).toBe(8);
    expect(goTo(in2026, named('chandra')).camera.distance).toBe(45);
    expect(goTo(in2026, named('webb')).camera.distance).toBe(600);
    expect(goTo(in2026, named('spitzer')).focus).toBe('sun');
  });
});

describe('going to a space telescope’s model (#863)', () => {
  it('puts the camera on its craft, about the body it flies by; not for one on the ground', () => {
    const chandra = goToCraft(in2026, named('chandra'));
    expect(chandra?.craft).toBe('s25867');
    expect(chandra?.focus).toBe('earth');
    expect(chandra?.view).toBe('free');
    expect(goToCraft(in2026, named('kepler'))?.focus).toBe('sun');
    expect(goToCraft(in2026, named('alma'))).toBeNull();
  });
});
