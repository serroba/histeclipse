import { describe, expect, it } from 'vitest';

import { parseViewState } from '../state/url';
import { jumpQuery } from './timeJump';

const NOW = new Date('2026-11-15T00:00:00Z');
const READER = 't=2026-07-04T15:30Z&cal=gregorian&cam=10,20,3.00&layers=empires&ma=100&scale=all';
const go = (entry: Parameters<typeof jumpQuery>[0]) => {
  const { state, warnings } = parseViewState(jumpQuery(entry, READER, 2026), NOW);
  expect(warnings).toEqual([]);
  return state;
};

describe('going to a moment typed', () => {
  it('Given a year of the last 11,700 years, Then it opens in the years, on the reader’s day and hour, the rest kept', () => {
    const state = go({ kind: 'year', year: -43 });
    expect(state.ma).toBeNull();
    expect(state.time.date.year).toBe(-43);
    expect(state.time.date.month).toBe(7);
    expect(state.time.minuteOfDay).toBe(15 * 60 + 30);
    expect(state.camera.target).toEqual({ latitude: 10, longitude: 20 });
    expect(state.layers).toEqual(new Set(['empires']));
    expect(go({ kind: 'year', year: -9699 }).ma).toBeNull();
  });

  it('Given a link with no moment, Then a year opens at midsummer noon', () => {
    const { state } = parseViewState(jumpQuery({ kind: 'year', year: 1969 }, 'ma=5', 2026), NOW);
    expect([state.time.date.month, state.time.minuteOfDay]).toEqual([7, 12 * 60]);
  });

  it('Given an older year, Then it opens in the ice ages, as an age', () => {
    const state = go({ kind: 'year', year: -9700 });
    expect(state.ma).toBe(0.012);
    expect(state.deepScale).toBe('ice');
  });

  it.each([
    [0.06, 'ice'],
    [2.6, 'ice'],
    [100, 'all'],
    [540, 'all'],
    [3500, 'eons'],
  ] as const)('Given %d million years ago, Then the %s range draws it', (ma, scale) => {
    const state = go({ kind: 'ma', ma });
    expect(state.ma).toBe(ma);
    expect(state.deepScale).toBe(scale);
  });

  it('Given the bar zoomed, When they go to a time, Then its span shows whole (#1078)', () => {
    const query = jumpQuery(
      { kind: 'ma', ma: 250 },
      'ma=100&scale=all&dw=124,76&yw=1854,2026',
      2026,
    );
    expect(query).not.toMatch(/dw=|yw=/);
    expect(query).toMatch(/ma=250/);
  });
});
