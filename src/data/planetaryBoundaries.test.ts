import { describe, expect, it } from 'vitest';

import json from '../../public/data/planetary-boundaries.json';
import {
  loadPlanetaryBoundaries,
  MAX_REACH,
  reachOf,
  statusOf,
  transgressedCount,
  valueText,
  variableReach,
  zoneOf,
  type PlanetaryBoundaries,
} from './planetaryBoundaries';

const data: PlanetaryBoundaries = await loadPlanetaryBoundaries('/pb.json', () =>
  Promise.resolve(new Response(JSON.stringify(json))),
);

function variable(id: string) {
  const found = data.boundaries.flatMap((each) => each.variables).find((each) => each.id === id);
  if (found === undefined) throw new Error(`no variable ${id}`);
  return found;
}

describe('the planetary boundaries', () => {
  it('are nine, with the control variables of the 2026 table', () => {
    expect(data.boundaries).toHaveLength(9);
    // Thirteen assessed, the proposed regional aerosol boundary besides, and novel entities.
    expect(data.boundaries.flatMap((each) => each.variables)).toHaveLength(15);
  });

  it('place the reference at 0, the boundary at 1 and the high-risk line at 2', () => {
    const co2 = { reference: 280, boundary: 350, highRisk: 450 };
    expect(reachOf({ scale: 'linear' }, co2, 280)).toBe(0);
    expect(reachOf({ scale: 'linear' }, co2, 350)).toBe(1);
    expect(reachOf({ scale: 'linear' }, co2, 450)).toBe(2);
    expect(reachOf({ scale: 'linear' }, co2, 426)).toBeCloseTo(1.76);
    expect(reachOf({ scale: 'linear' }, co2, 200)).toBe(0);
  });

  it('read a variable where less is worse the other way round', () => {
    const forest = { reference: 100, boundary: 78, highRisk: 54 };
    expect(reachOf({ scale: 'linear' }, forest, 64)).toBeCloseTo(1 + 14 / 24);
    expect(zoneOf(reachOf({ scale: 'linear' }, forest, 64))).toBe('increasing');
  });

  it('spread extinction rates by tens, and ease what goes past the high-risk line', () => {
    const extinctions = { reference: 1, boundary: 10, highRisk: 100 };
    expect(reachOf({ scale: 'log' }, extinctions, 10)).toBeCloseTo(1);
    expect(reachOf({ scale: 'log' }, extinctions, 1000)).toBeGreaterThan(2);
    expect(
      reachOf({ scale: 'linear' }, { reference: 0, boundary: 1, highRisk: 1.5 }, 1e6),
    ).toBeLessThanOrEqual(MAX_REACH);
  });

  it('give each boundary the status the report states for 2026', () => {
    for (const boundary of data.boundaries) {
      expect(statusOf(boundary, 'phc2026'), boundary.id).toBe(boundary.stated);
    }
  });

  it('find seven of nine transgressed in 2026, and six in Richardson et al. (2023)', () => {
    expect(transgressedCount(data, 'phc2026')).toBe(7);
    expect(transgressedCount(data, 'richardson2023')).toBe(6);
    const ocean = data.boundaries.find((each) => each.id === 'ocean');
    if (ocean === undefined) throw new Error('no ocean');
    expect(statusOf(ocean, 'richardson2023')).toBe('within');
  });

  it('keep the 2026 table’s global phosphorus as given, inside its boundary, and say so', () => {
    const phosphorus = variable('phosphorusGlobal');
    expect(zoneOf(variableReach(phosphorus, 'phc2026')?.low ?? 0)).toBe('safe');
    expect(zoneOf(variableReach(phosphorus, 'richardson2023')?.low ?? 0)).toBe('increasing');
    expect(phosphorus.note).toMatch(/strongly transgressed/);
  });

  it('count the proposed regional aerosol boundary out of the status', () => {
    const southAsia = variable('aodSouthAsia');
    expect(southAsia.proposed).toBe(true);
    expect(zoneOf(variableReach(southAsia, 'phc2026')?.low ?? 0)).toBe('increasing');
    expect(variableReach(southAsia, 'richardson2023')).toBeNull();
  });

  it('put a value at the high-risk line in the high-risk zone, and one at the boundary inside it', () => {
    expect(zoneOf(1)).toBe('safe');
    expect(zoneOf(2)).toBe('high');
    // 100–1000 extinctions per million species-years: from the high-risk line up, as the report has it.
    expect(zoneOf(variableReach(variable('extinctions'), 'phc2026')?.low ?? 0)).toBe('high');
  });

  it('place novel entities in the high-risk zone by judgement, with no numbers', () => {
    const novel = variableReach(variable('untested'), 'phc2026');
    expect(novel?.judged).toBe(true);
    expect(zoneOf(novel?.low ?? 0)).toBe('high');
    expect(valueText(variable('untested'), 'phc2026')).toBe('high-risk zone (not quantified)');
  });

  it('write values as the report does: a range, “more than”, or one number', () => {
    expect(valueText(variable('extinctions'), 'phc2026')).toBe('100–1,000 E/MSY');
    expect(valueText(variable('extinctions'), 'richardson2023')).toBe('more than 100 E/MSY');
    expect(valueText(variable('co2'), 'phc2026')).toBe('426 ppm');
    expect(variableReach(variable('extinctions'), 'richardson2023')?.high).toBeNull();
  });
});
