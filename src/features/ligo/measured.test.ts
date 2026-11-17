import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import * as v from 'valibot';

import { DETECTORS, GW150914_SCHEMA, lag, measuredWave } from './measured';

const parseGw150914 = (raw: unknown) => v.parse(GW150914_SCHEMA, raw);

const raw: unknown = JSON.parse(
  readFileSync(new URL('../../../public/data/gw150914.json', import.meta.url), 'utf8'),
);
const data = parseGw150914(raw);

describe('GW150914 as LIGO measured it: the shipped file (#830)', () => {
  it('has both detectors, each with what it measured and the best-fit waveform', () => {
    for (const detector of DETECTORS) {
      expect(data.detectors[detector].observed.length).toBe(data.plus.length);
      expect(data.detectors[detector].waveform.length).toBe(data.plus.length);
    }
    expect(data.plus.length).toBeGreaterThan(400);
  });

  it('reached Livingston about 7 ms before Hanford, upside down there', () => {
    const { seconds, inverted } = lag(
      data.detectors.H1.waveform,
      data.detectors.L1.waveform,
      data.rate,
      0.012,
    );
    expect(seconds).toBeGreaterThan(0.006);
    expect(seconds).toBeLessThan(0.008);
    expect(inverted).toBe(true);
    // What was measured shows the same, through the noise.
    const measured = lag(data.detectors.H1.observed, data.detectors.L1.observed, data.rate, 0.012);
    expect(measured.seconds).toBeCloseTo(seconds, 2);
  });

  it('peaks near 10⁻²¹, a little before 09:50:45.42', () => {
    const wave = measuredWave(data);
    expect(wave.peak).toBeGreaterThan(0.8e-21);
    expect(wave.peak).toBeLessThan(1.3e-21);
    expect(data.merger).toBeGreaterThan(0.4);
    expect(data.merger).toBeLessThan(0.43);
  });
});

describe('the measured wave as the ring plays it', () => {
  const wave = measuredWave(data);

  it('runs about a fifth of a second, from before the merger to after', () => {
    expect(wave.start).toBeLessThan(-0.14);
    expect(wave.end).toBeGreaterThan(0.03);
    expect(wave.at(wave.start - 0.01)).toEqual({ plus: 0, cross: 0 });
  });

  it('is strongest at the merger, in strain', () => {
    const size = (t: number): number => Math.hypot(wave.at(t).plus, wave.at(t).cross);
    expect(size(0)).toBeCloseTo(wave.peak, 23);
    expect(size(-0.1)).toBeLessThan(size(-0.02));
  });

  it('rises in pitch toward the merger, from tens of hertz to well over a hundred', () => {
    expect(wave.frequency(-0.1)).toBeGreaterThan(25);
    expect(wave.frequency(-0.1)).toBeLessThan(60);
    expect(wave.frequency(-0.005)).toBeGreaterThan(100);
    expect(wave.frequency(-0.005)).toBeLessThan(250);
    expect(wave.frequency(1)).toBe(0);
  });
});

describe('reading the file', () => {
  const good = raw as Record<string, unknown>;
  const refused = (file: unknown): boolean => !v.safeParse(GW150914_SCHEMA, file).success;

  it('refuses what is not this event’s file, or a series too short', () => {
    expect(refused(good)).toBe(false);
    expect(refused(null)).toBe(true);
    expect(refused({ ...good, event: 'GW170817' })).toBe(true);
    expect(refused({ ...good, detectors: { L1: data.detectors.L1 } })).toBe(true);
    expect(refused({ ...good, cross: [1, 2] })).toBe(true);
    expect(refused({ ...good, plus: ['a'] })).toBe(true);
    expect(refused({ ...good, rate: -1 })).toBe(true);
  });
});

describe('the lag between two series', () => {
  it('finds a shift and a sign', () => {
    const earlier = [0, 0, 1, 3, 1, 0, 0, 0, 0, 0];
    const later = [0, 0, 0, 0, -1, -3, -1, 0, 0, 0];
    expect(lag(later, earlier, 1000, 0.004)).toEqual({ seconds: 0.002, inverted: true });
  });
});
