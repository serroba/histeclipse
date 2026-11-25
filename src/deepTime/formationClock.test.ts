import { describe, expect, it } from 'vitest';

import {
  AFTER,
  APPROACH,
  FIRST_SOLIDS_MA,
  formationMa,
  formationScale,
  formationSeconds,
} from './formationClock';

const YEAR = 365.25 * 86_400;
const MYR = 1e6 * YEAR;
const EARLY = formationScale(4510);
const YOUNG = formationScale(4350);

describe('the formation clock (#1218)', () => {
  it('runs from 10,000 years after the first solids to 10 million years after the impact', () => {
    const before = (FIRST_SOLIDS_MA - 4510) * MYR;
    expect(EARLY.secondsAt(0) + before).toBeCloseTo(1e4 * YEAR, -3);
    expect(EARLY.secondsAt(EARLY.end)).toBeCloseTo(AFTER, -6);
    expect(EARLY.secondsAt(-1)).toBe(EARLY.secondsAt(0));
    expect(EARLY.secondsAt(EARLY.end + 1)).toBe(EARLY.secondsAt(EARLY.end));
  });

  it('gives the approach a unit, the impact at its end', () => {
    const impact = EARLY.positionAt(0);
    expect(EARLY.positionAt(-APPROACH)).toBeCloseTo(impact - 1);
    expect(EARLY.secondsAt(impact - 0.5)).toBeCloseTo(-APPROACH / 2);
    expect(EARLY.secondsAt(impact)).toBe(0);
  });

  it('runs on tenfolds either side, a later impact taking longer to come', () => {
    const impact = EARLY.positionAt(0);
    expect(EARLY.positionAt(3600 * 9)).toBeCloseTo(impact + 1);
    expect(EARLY.positionAt(1 * MYR - (FIRST_SOLIDS_MA - 4510) * MYR)).toBeCloseTo(2);
    expect(YOUNG.positionAt(0)).toBeGreaterThan(impact);
    expect(EARLY.positionAt(-1e6 * MYR)).toBe(0);
    expect(EARLY.positionAt(1e6 * MYR)).toBe(EARLY.end);
  });

  it('finds again the moment at each position, on all three parts', () => {
    for (const scale of [EARLY, YOUNG]) {
      for (const position of [0, 1, 2.5, scale.positionAt(0) - 0.5, scale.positionAt(0), 8, 12]) {
        expect(scale.positionAt(scale.secondsAt(position))).toBeCloseTo(position, 9);
      }
    }
  });

  it('says the time since the first solids, then before and after the impact', () => {
    expect(EARLY.text(1 * MYR - (FIRST_SOLIDS_MA - 4510) * MYR)).toBe(
      '1 million years after the first solids',
    );
    expect(EARLY.text(-1.5 * 3600)).toBe('1.5 hours before the impact');
    expect(EARLY.text(0)).toBe('The impact');
    expect(EARLY.text(1.5 * MYR)).toBe('1.5 million years after the impact');
  });

  it('marks the first solids, the impact and the end', () => {
    const labels = EARLY.marks.map(([, label]) => label);
    expect(labels).toEqual(['First solids', 'Impact', '1,000 years', '10 Myr']);
    expect(EARLY.positionAt(EARLY.marks[0]?.[0] ?? NaN)).toBeCloseTo(0);
  });

  it('plays the whole in about a minute at Slow, faster with the pace', () => {
    expect(EARLY.end / EARLY.advance('slow', 1, 0)).toBeGreaterThan(50);
    expect(EARLY.end / EARLY.advance('slow', 1, 0)).toBeLessThan(80);
    expect(EARLY.advance('normal', 1, 0)).toBeLessThan(EARLY.advance('fast', 1, 0));
  });

  it('plays at half pace from Theia coming in to a day after the impact (#180)', () => {
    const full = EARLY.advance('normal', 1, 0);
    expect(EARLY.advance('normal', 1, EARLY.positionAt(-APPROACH))).toBeCloseTo(full / 2);
    expect(EARLY.advance('normal', 1, EARLY.positionAt(3600))).toBeCloseTo(full / 2);
    expect(EARLY.advance('normal', 1, EARLY.positionAt(2 * 86_400))).toBe(full);
  });

  it('turns seconds since the impact into deep time’s moment and back', () => {
    expect(formationMa(4510, 0)).toBe(4510);
    expect(formationMa(4510, 1.5 * MYR)).toBeCloseTo(4508.5);
    expect(formationSeconds(4510, 4567.3)).toBeCloseTo(-57.3 * MYR, -6);
    expect(formationSeconds(4510, formationMa(4510, 123 * YEAR))).toBeCloseTo(123 * YEAR, -2);
  });
});
