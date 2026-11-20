import { readFileSync } from 'node:fs';

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import {
  columnTime,
  GW170817_SCHEMA,
  mergerSeconds,
  tileColour,
  tilesOf,
  yOfFrequency,
} from './recorded';
import { recordedClock, trackPath } from './recordedPlot';
import { chirp, GW170817_MODEL } from './strain';

const file: unknown = JSON.parse(readFileSync('public/data/gw170817.json', 'utf8'));
const data = v.parse(GW170817_SCHEMA, file);

describe('GW170817 as LIGO and Virgo recorded it (#1000)', () => {
  it('reads the pipeline’s file: 48 frequencies, 8.5 s at 64 columns a second, three detectors', () => {
    expect(data.frequencies).toHaveLength(48);
    expect(data.columns).toBe(544);
    expect(columnTime(data, 0)).toBe(-8);
    expect(columnTime(data, data.columns)).toBeCloseTo(0.5, 9);
    for (const detector of ['H1', 'L1', 'V1'] as const) {
      expect(tilesOf(data, detector)).toHaveLength(48 * 544);
    }
    expect(mergerSeconds(data)).toBeCloseTo(4.43, 9);
  });

  it('refuses a map without a tile for each frequency and column', () => {
    const short = { ...data, detectors: { ...data.detectors, V1: btoa('abc') } };
    expect(v.safeParse(GW170817_SCHEMA, short).success).toBe(false);
  });

  it('shows the chirp along the model’s track at Hanford and Livingston, not at Virgo', () => {
    const wave = chirp({ ...GW170817_MODEL, from: 30 });
    /** The mean of the brightest tile about the track, its last 3 s, and 4 s earlier. */
    const along = (detector: 'H1' | 'L1' | 'V1'): { on: number; off: number } => {
      const tiles = tilesOf(data, detector);
      const sums = { on: 0, off: 0, count: 0 };
      const brightest = (row: number, column: number): number =>
        Math.max(
          ...[row - 1, row, row + 1]
            .filter((at) => at >= 0 && at < data.frequencies.length)
            .map((at) => tiles[at * data.columns + column] ?? 0),
        );
      for (let column = 0; column < data.columns; column += 1) {
        const t = columnTime(data, column);
        const gated = detector === 'L1' && t > data.gated.from - 0.3 && t < data.gated.to + 0.3;
        if (t <= -3 || t >= -0.05 || gated) continue;
        const hertz = wave.frequency(t);
        let row = 0;
        data.frequencies.forEach((frequency, index) => {
          const best = data.frequencies[row] ?? 0;
          if (Math.abs(frequency - hertz) < Math.abs(best - hertz)) row = index;
        });
        sums.on += brightest(row, column);
        sums.off += brightest(row, column - 4 * data.rate);
        sums.count += 1;
      }
      return { on: sums.on / sums.count, off: sums.off / sums.count };
    };
    for (const detector of ['H1', 'L1'] as const) {
      const { on, off } = along(detector);
      expect(on).toBeGreaterThan(3 * off);
    }
    const virgo = along('V1');
    expect(virgo.on).toBeLessThan(1.5 * virgo.off);
  });

  it('places Livingston’s zeroed glitch about 1.1 s before the merger', () => {
    expect((data.gated.from + data.gated.to) / 2).toBeCloseTo(-1.05, 1);
    expect(data.gated.to - data.gated.from).toBeCloseTo(0.3, 2);
  });

  it('lays frequency up on a log scale, and colours from night to gold', () => {
    expect(yOfFrequency(data, data.frequencies[0] ?? 0, 80)).toBeCloseTo(80, 9);
    expect(yOfFrequency(data, data.frequencies.at(-1) ?? 0, 80)).toBeCloseTo(0, 9);
    expect(tileColour(0)).toEqual([4, 8, 22]);
    expect(tileColour(255)).toEqual([255, 205, 90]);
    expect(tileColour(300)).toEqual([255, 205, 90]);
    expect(tileColour(127.5)).toEqual([130, 65, 115]);
  });

  it('draws the model’s track rising to the top of the plot before the merger', () => {
    const track = trackPath(data);
    expect(track.startsWith('M')).toBe(true);
    const ys = [...track.matchAll(/,(-?[\d.]+)/gu)].map((match) => Number(match[1]));
    expect(ys[0]).toBeGreaterThan(ys.at(-1) ?? 0);
    expect(recordedClock(4.43)).toBe('12:41:04.430 UTC');
  });
});
