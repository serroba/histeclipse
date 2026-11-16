import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import served from '../../public/data/ozone/maps.json' with { type: 'json' };
import type { Fetch } from '../util/fetchJson';
import {
  LEGEND_DU,
  loadOzoneMaps,
  mapOf,
  mapText,
  omittedText,
  ozoneColour,
  ozoneColours,
} from './ozoneMaps';

const serve =
  (body: unknown): Fetch =>
  () =>
    Promise.resolve(Response.json(body));
const maps = await loadOzoneMaps('/data/ozone/maps.json', serve(served));

describe('ozone/maps.json', () => {
  it('has an October for every year from 1970 to 2025 but the two it leaves out, each with its file, credited to MSR-2 and Copernicus under CC BY 4.0', () => {
    expect(maps.omitted).toEqual([1977, 1978]);
    expect([...maps.years.map(({ year }) => year), ...maps.omitted].sort()).toEqual(
      Array.from({ length: 56 }, (_, k) => 1970 + k),
    );
    for (const each of maps.years) expect(existsSync(`public/data/ozone/${each.file}`)).toBe(true);
    expect(maps.licence).toBe('CC BY 4.0');
    expect(maps.credit).toContain('van der A');
    expect(maps.credit).toContain('Copernicus Climate Change Service');
    expect(maps.holeDU).toBe(220);
  });

  it('shows the hole opening: none under the line in the 1970s, the widest in the years about 2000, the small one of 2019', () => {
    const below = (year: number) => mapOf(maps, year)?.belowMkm2 ?? Number.NaN;
    expect(below(1970)).toBe(0);
    expect(below(1979)).toBe(0);
    expect(below(1985)).toBeGreaterThan(5);
    expect(below(2006)).toBeGreaterThan(19);
    expect(below(2019)).toBeLessThan(10);
    expect(mapOf(maps, 2006)?.minimumDU).toBeLessThan(130);
    // Before 1979, a coarser grid with gaps: no area where the south is not all there.
    expect(mapOf(maps, 1975)?.gridDeg).toEqual([1, 1.5]);
    expect(mapOf(maps, 1975)?.covered).toBeLessThan(0.9);
    expect(mapOf(maps, 1975)?.belowMkm2).toBeNull();
    expect(mapOf(maps, 1976)?.minimumDU).toBeNull();
    expect(maps.years.filter(({ year }) => year >= 1979).every((each) => each.covered === 1)).toBe(
      true,
    );
    expect(mapOf(maps, 1977)).toBeNull();
    expect(mapOf(maps, 2006)?.gridDeg).toEqual([0.5, 0.5]);
    expect(mapOf(maps, 1969)).toBeNull();
  });

  it('is refused with a file that is not an October’s, or a step of nothing', async () => {
    const [first] = served.years;
    const stray = { ...served, years: [{ ...first, file: '../elsewhere.png' }] };
    await expect(loadOzoneMaps('/x', serve(stray))).rejects.toThrow();
    const flat = { ...served, encoding: { offsetDU: 100, stepDU: 0 } };
    await expect(loadOzoneMaps('/x', serve(flat))).rejects.toThrow();
  });
});

describe('an October in words', () => {
  it('Given a year with a hole, Then its area under the line and its lowest ozone', () => {
    const found = mapOf(maps, 2006);
    if (found === null) throw new Error('no 2006');
    expect(found.belowMkm2).not.toBeNull();
    expect(mapText(maps, found)).toBe(
      `Ozone over the whole Earth, October 2006, the month’s mean: under 220 Dobson units over ${(found.belowMkm2 ?? 0).toFixed(1)} million km² of the south, lowest ${String(Math.round(found.minimumDU ?? 0))}.`,
    );
  });

  it('Given a year before the hole, Then it says there is none', () => {
    const found = mapOf(maps, 1979);
    if (found === null) throw new Error('no 1979');
    expect(mapText(maps, found)).toContain(
      'nowhere in the south under 220 Dobson units, the line that marks the hole, lowest 262',
    );
  });

  it('Given an early year with gaps, Then it says how much of the Earth has values, and that the gaps are not filled', () => {
    const patchy = mapOf(maps, 1975);
    const northern = mapOf(maps, 1976);
    if (patchy === null || northern === null) throw new Error('no early years');
    expect(mapText(maps, patchy)).toBe(
      'Ozone over the whole Earth, October 1975, the month’s mean: the one early instrument gave values for 77% of the Earth, the lowest in the south 218 Dobson units. The gaps are grey, not filled.',
    );
    expect(mapText(maps, northern)).toContain('45% of the Earth, none of it in the far south');
  });

  it('Given a year left out, Then it says why; any other year says nothing', () => {
    expect(omittedText(maps, 1977)).toContain('under a tenth of the Earth');
    expect(omittedText(maps, 2006)).toBeNull();
    expect(omittedText(maps, 1960)).toBeNull();
  });
});

describe('the colours of ozone', () => {
  it('Given amounts along the scale, Then blue at the hole’s line through pale grey to red where ozone is thick, and an opening under the line', () => {
    const edge = ozoneColour(220);
    const middle = ozoneColour(310);
    const thick = ozoneColour(400);
    expect(edge[2]).toBeGreaterThan(edge[0] + 100);
    expect(Math.abs(middle[0] - middle[2])).toBeLessThan(5);
    expect(thick[0]).toBeGreaterThan(thick[2] + 100);
    expect(edge[3]).toBe(middle[3]);
    // Under the line the sheet thins, and by 200 it is gone: the hole is open.
    expect(ozoneColour(210)[3]).toBeCloseTo(edge[3] / 2, 5);
    expect(ozoneColour(200)[3]).toBe(0);
    expect(ozoneColour(120)[3]).toBe(0);
    // Past the top, the top's colour.
    expect(ozoneColour(700)).toEqual(ozoneColour(400));
    expect(LEGEND_DU[0]).toBe(220);
    expect(LEGEND_DU.at(-1)).toBe(400);
  });

  it('Given a map’s pixels, Then each is coloured by its ozone, one with no value grey, and one deep in the hole clear', () => {
    // 60 stands for 220 DU, 150 for 400; 0 for no value.
    const packed = new Uint8ClampedArray([60, 60, 60, 255, 150, 150, 150, 255, 0, 0, 0, 255]);
    const out = ozoneColours(packed, { offsetDU: 100, stepDU: 2 });
    const [r, g, b, a] = ozoneColour(220);
    expect([...out.slice(0, 4)]).toEqual([
      Math.round(r),
      Math.round(g),
      Math.round(b),
      Math.round(255 * a),
    ]);
    expect(out[4]).toBe(Math.round(ozoneColour(400)[0]));
    expect(out[4 + 3]).toBe(Math.round(255 * ozoneColour(400)[3]));
    // No value: grey, not the opening of the hole.
    expect([...out.slice(8, 12)]).toEqual([120, 120, 128, 153]);
    const open = ozoneColours(new Uint8ClampedArray([20, 20, 20, 255]), {
      offsetDU: 100,
      stepDU: 2,
    });
    expect(open[3]).toBe(0);
  });
});
