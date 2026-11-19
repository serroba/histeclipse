// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import type { Enso } from '../data/enso';
import { episodeStrips, stripRows } from './ensoStrips';

const enso = {
  indices: [
    {
      id: 'roni',
      episodes: [
        { phase: 'laNina', first: '1949-11', last: '1950-02', peak: -1, peakAt: '1950-01' },
        { phase: 'elNino', first: '1950-06', last: '1950-06', peak: 1, peakAt: '1950-06' },
        { phase: 'elNino', first: '1951-06', last: '1951-08', peak: 1, peakAt: '1951-07' },
      ],
    },
    { id: 'oni', episodes: [] },
  ],
} as unknown as Enso;

// January 1950 starts at 0, a pixel a month, twelve wide.
const startOf = (month: number): number => month - 1950 * 12;

describe('the El Niño and La Niña strips', () => {
  it('Given episodes, Then a strip an index, cut to the chart, and none outside it', () => {
    expect(episodeStrips(enso, startOf, 12)).toEqual([
      {
        id: 'roni',
        name: 'RONI',
        episodes: [
          { x: 0, width: 2, phase: 'laNina' },
          { x: 5, width: 1, phase: 'elNino' },
        ],
      },
      { id: 'oni', name: 'ONI', episodes: [] },
    ]);
  });

  it('Given strips, Then a named row each, its episodes, and the moment marked if there is one', () => {
    const strips = episodeStrips(enso, startOf, 12);
    const rows = stripRows(strips, 12, 6);
    expect(rows.map((row) => row.className)).toEqual(['enso-row is-roni', 'enso-row is-oni']);
    expect(rows[0]?.textContent).toBe('RONI');
    expect(rows[0]?.querySelectorAll('.enso-episode.is-laNina')).toHaveLength(1);
    expect(rows[1]?.querySelectorAll('.enso-episode')).toHaveLength(0);
    expect(rows[0]?.querySelector('.enso-mark')?.getAttribute('x1')).toBe('6.0');
    expect(stripRows(strips, 12, null)[0]?.querySelector('.enso-mark')).toBeNull();
  });
});
