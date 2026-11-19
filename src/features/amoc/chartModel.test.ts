import { describe, expect, it } from 'vitest';

import file from '../../../public/data/amoc/index.json';
import type { Amoc } from '../../data/amoc';
import { ROW_HEIGHT, ROW_WIDTH, amocChart } from './chartModel';

const amoc = file as unknown as Amoc;

describe('the AMOC’s charts (#925)', () => {
  it('Given the years since 1850, Then a row for each source, each on its own scale, the year marked', () => {
    const chart = amocChart(amoc, { first: 1850, last: 2026 }, 2010);
    expect(chart.rows.map(({ id }) => id)).toHaveLength(6);
    const rapid = chart.rows.find(({ id }) => id === 'rapid');
    expect(rapid?.line.startsWith('M')).toBe(true);
    expect(rapid?.band).toBe('');
    expect(rapid?.value).toMatch(/ Sv$/);
    // Each row is scaled to its own values and range: its line spreads over its height, inside it.
    for (const row of chart.rows.filter(({ line }) => line !== '')) {
      const ys = [...row.line.matchAll(/,(-?\d+\.\d)/g)].map((match) => Number(match[1]));
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(ROW_HEIGHT * 0.2);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...ys)).toBeLessThanOrEqual(ROW_HEIGHT);
    }
    expect(chart.cursorX).toBeCloseTo(((2010.5 - 1850) / 177) * ROW_WIDTH, 6);
    const terhaar = chart.rows.find(({ id }) => id === 'terhaar-2025-era5');
    expect(terhaar?.zeroY).not.toBeNull();
    expect(terhaar?.band.endsWith('Z')).toBe(true);
  });

  it('Given years a source does not reach, Then its row says so; a year outside, no mark', () => {
    const chart = amocChart(amoc, { first: 400, last: 800 }, 1990);
    expect(chart.rows.find(({ id }) => id === 'rapid')).toMatchObject({ line: '', value: null });
    expect(chart.rows.find(({ id }) => id === 'thornalley-2018')?.line).not.toBe('');
    expect(chart.cursorX).toBeNull();
  });
});
