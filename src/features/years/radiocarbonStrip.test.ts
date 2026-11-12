import { describe, expect, it } from 'vitest';

import data from '../../../public/data/radiocarbon.json';
import type { Radiocarbon } from '../../data/radiocarbon';
import { RADIOCARBON_EVENTS } from '../../data/radiocarbonEvents';
import { SOURCES } from '../../sources/registry';
import { stripPoints } from './radiocarbonStrip';

const real = data as Radiocarbon;

describe('the radiocarbon strip', () => {
  it('runs left to right across the years shown, scaled to fill the strip', () => {
    const points = stripPoints(real.curves.intcal20, -9699, 2026);
    expect(points.length).toBeGreaterThan(100);
    expect(points.length).toBeLessThanOrEqual(601);
    const xs = points.map(([x]) => x);
    expect(xs.every((x, i) => i === 0 || x > (xs[i - 1] ?? 0))).toBe(true);
    expect(Math.min(...points.map(([, y]) => y))).toBe(0);
    expect(Math.max(...points.map(([, y]) => y))).toBe(1);
    // The curves end in 1950: the line stops short of today.
    expect(xs.at(-1)).toBeLessThan(1);
  });

  it('marks events the site knows the sources of, in order', () => {
    for (const [index, event] of RADIOCARBON_EVENTS.entries()) {
      expect(event.from).toBeLessThanOrEqual(event.to);
      for (const source of event.sources) expect(SOURCES[source]).toBeDefined();
      const next = RADIOCARBON_EVENTS[index + 1];
      if (next !== undefined) expect(event.from).toBeLessThanOrEqual(next.from);
    }
  });
});
