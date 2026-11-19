import { describe, expect, it } from 'vitest';

import file from '../../public/data/enso/index.json';
import {
  ensoText,
  ensoYearText,
  episodeAt,
  loadEnso,
  monthName,
  monthNumber,
  monthOf,
  provisional,
  readingsAt,
  shared,
  valueAt,
  type Enso,
} from './enso';

const index = (
  id: string,
  first: string,
  values: number[],
  episodes: Enso['indices'][number]['episodes'],
) => ({
  id,
  label: id,
  official: 'o',
  method: 'm',
  baseline: 'b',
  url: 'https://example.org/',
  first,
  values,
  episodes,
});

const ENSO: Enso = {
  schemaVersion: 1,
  credit: 'c',
  source: 'https://example.org/',
  licence: 'l',
  accessed: '2026-11-19',
  units: '°C',
  placed: 'p',
  threshold: 0.5,
  seasons: 5,
  provisionalMonths: 2,
  indices: [
    index(
      'roni',
      '2024-01',
      [-0.6, -1.1, 0.2, 1.2],
      [
        { phase: 'laNina', first: '2024-01', last: '2024-02', peak: -1.1, peakAt: '2024-02' },
        {
          phase: 'elNino',
          first: '2024-04',
          last: '2024-04',
          peak: 1.2,
          peakAt: '2024-04',
          ongoing: true,
        },
      ],
    ),
    index(
      'oni',
      '2024-01',
      [-0.4, -0.46, 0.4, 1.5],
      [
        {
          phase: 'elNino',
          first: '2024-04',
          last: '2024-04',
          peak: 1.5,
          peakAt: '2024-04',
          ongoing: true,
        },
      ],
    ),
  ],
};

describe('NOAA’s ENSO indices', () => {
  it('Given the published file, Then it reads, with both indices from 1950', async () => {
    const read = await loadEnso('/enso.json', () =>
      Promise.resolve(new Response(JSON.stringify(file))),
    );
    expect(read.indices.map(({ id }) => id)).toEqual(['roni', 'oni']);
    expect(read.indices.every(({ first }) => first === '1950-01')).toBe(true);
    // The 1997–98 El Niño, by both.
    const at = monthOf(1997, 12);
    expect(readingsAt(read, at).map(({ phase }) => phase)).toEqual(['elNino', 'elNino']);
  });

  it('Given months, Then they count from year 0 and read in words', () => {
    expect(monthNumber('2024-03')).toBe(monthOf(2024, 3));
    expect(monthName(monthOf(2026, 9))).toBe('September 2026');
    expect(monthName(monthOf(2026, 1))).toBe('January 2026');
  });

  it('Given a month, Then each index’s value and episode, none outside its months', () => {
    const [roni] = ENSO.indices;
    if (roni === undefined) throw new Error('no index');
    expect(valueAt(roni, monthOf(2024, 2))).toBe(-1.1);
    expect(valueAt(roni, monthOf(2023, 12))).toBeNull();
    expect(episodeAt(roni, monthOf(2024, 2))?.phase).toBe('laNina');
    expect(episodeAt(roni, monthOf(2024, 3))).toBeNull();
    expect(shared(ENSO)).toEqual({ first: monthOf(2024, 1), last: monthOf(2024, 4) });
  });

  it('Given the last months, Then they are provisional, and no others', () => {
    expect(provisional(ENSO, monthOf(2024, 4))).toBe(true);
    expect(provisional(ENSO, monthOf(2024, 3))).toBe(true);
    expect(provisional(ENSO, monthOf(2024, 2))).toBe(false);
    expect(provisional(ENSO, monthOf(2024, 5))).toBe(false);
  });

  it('Given the indices disagree, Then each is said with its phase and value', () => {
    expect(ensoText(ENSO, monthOf(2024, 2))).toBe(
      'February 2024: the indices disagree. RONI: La Niña (−1.10 °C); ONI: neither (−0.46 °C).',
    );
  });

  it('Given they agree, Then once, with both values, and provisional where NOAA may revise it', () => {
    expect(ensoText(ENSO, monthOf(2024, 4))).toBe(
      'April 2024: El Niño by both indices (RONI +1.20 °C, ONI +1.50 °C). Provisional: NOAA may still revise it.',
    );
    expect(ensoText(ENSO, monthOf(2024, 3))).toBe(
      'March 2024: neither El Niño nor La Niña (RONI +0.20 °C, ONI +0.40 °C). Provisional: NOAA may still revise it.',
    );
  });

  it('Given one index alone has the month, Then by its index', () => {
    const one: Enso = { ...ENSO, indices: ENSO.indices.slice(0, 1) };
    expect(ensoText(one, monthOf(2024, 1))).toBe(
      'January 2024: La Niña by its index (RONI −0.60 °C).',
    );
  });

  it('Given a month outside the files, Then where they run', () => {
    expect(ensoText(ENSO, monthOf(1900, 6))).toBe(
      'NOAA’s indices run from January 2024 to April 2024: none for June 1900.',
    );
  });

  it('Given a year both indices name alike, Then once, with each index’s peak', () => {
    const alike: Enso = {
      ...ENSO,
      indices: ENSO.indices.map((each) => ({
        ...each,
        episodes: [
          {
            phase: 'elNino',
            first: '1997-05',
            last: '1998-04',
            peak: each.id === 'roni' ? 2.3 : 2.4,
            peakAt: '1997-11',
          },
          { phase: 'laNina', first: '1998-07', last: '2001-01', peak: -1.6, peakAt: '1999-12' },
        ],
        first: '1950-01',
        values: new Array<number>(900).fill(0),
      })),
    };
    expect(ensoYearText(alike, 1998)).toBe(
      'In 1998, by both indices: the El Niño of 1997–98 (peak RONI +2.30 °C, ONI +2.40 °C) and the La Niña of 1998–2001 (peak RONI −1.60 °C, ONI −1.60 °C).',
    );
    expect(ensoYearText(alike, 1960)).toBe('In 1960, neither El Niño nor La Niña by either index.');
    expect(ensoYearText(alike, 1949)).toBeNull();
  });

  it('Given a year the indices name differently, Then index by index; one index alone, by its name', () => {
    expect(ensoYearText(ENSO, 2024)).toBe(
      'In 2024: RONI, the La Niña of 2024 (peak −1.10 °C) and the El Niño of 2024, still on (peak +1.20 °C); ONI, the El Niño of 2024, still on (peak +1.50 °C).',
    );
    const one: Enso = { ...ENSO, indices: ENSO.indices.slice(1) };
    expect(ensoYearText(one, 2024)).toBe(
      'In 2024, by ONI: the El Niño of 2024, still on (peak +1.50 °C).',
    );
    const quiet: Enso = { ...one, indices: one.indices.map((each) => ({ ...each, episodes: [] })) };
    expect(ensoYearText(quiet, 2024)).toBe('In 2024, neither El Niño nor La Niña by ONI.');
    const apart: Enso = {
      ...ENSO,
      indices: [{ ...ENSO.indices[0], episodes: [] } as Enso['indices'][number], ...one.indices],
    };
    expect(ensoYearText(apart, 2024)).toMatch(/^In 2024: RONI, neither; ONI, the El Niño/);
  });
});
