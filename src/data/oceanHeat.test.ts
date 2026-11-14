import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { heatColours, loadOceanHeat, mapText, NOT_SIGNIFICANT, trendOf } from './oceanHeat';

const file = readFileSync(
  new URL('../../public/data/ocean-heat-map/index.json', import.meta.url),
  'utf8',
);
const index = await loadOceanHeat('index.json', () => Promise.resolve(new Response(file)));

describe('the ocean heat maps', () => {
  it('Given the real index, Then three maps, one bound, in W/m²', () => {
    expect(index.maps.map((map) => map.id)).toEqual([
      '0-700m-1960-2025',
      '0-2000m-1960-2025',
      '0-2000m-2005-2025',
    ]);
    expect(index.maps[1] === undefined ? '' : mapText(index.maps[1])).toBe(
      '0-2000 m, 1960–2025: on average 0.65 W/m² gained; 83% of the sea significant at 10%.',
    );
  });

  it('Given bytes, Then the trend runs from −bound to +bound', () => {
    expect(trendOf(0, 3)).toBe(-3);
    expect(trendOf(255, 3)).toBe(3);
    expect(trendOf(127.5, 3)).toBeCloseTo(0);
  });

  it('Given no change, Then pale; given a quarter of the bound, Then halfway to the deep colour', () => {
    const out = heatColours(new Uint8ClampedArray([127.5, 128, 255, 255, 159, 128, 255, 255]), 3);
    // 128 is a hair over no change: all but pale.
    expect(out[0]).toBeGreaterThan(228);
    expect(out[2]).toBeGreaterThan(200);
    expect(out[4]).toBeGreaterThan(205);
    expect(out[4]).toBeLessThan(220);
  });

  it('Given packed pixels, Then gains orange, losses blue, faded where not significant, nothing on land', () => {
    const packed = new Uint8ClampedArray([
      255,
      128,
      255,
      255, // +3, significant
      255,
      128,
      0,
      255, // +3, not significant
      0,
      128,
      255,
      255, // −3, significant
      200,
      128,
      255,
      0, // land
    ]);
    const out = heatColours(packed, 3);
    expect([...out.slice(0, 4)]).toEqual([190, 40, 20, Math.round(255 * 0.85)]);
    expect(out[7]).toBe(Math.round(255 * 0.85 * NOT_SIGNIFICANT));
    expect([...out.slice(8, 11)]).toEqual([40, 80, 200]);
    expect([...out.slice(12, 16)]).toEqual([0, 0, 0, 0]);
  });
});
