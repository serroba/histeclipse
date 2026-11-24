import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { begin, clearLedger, end, partsWithin, timed, timedWithin } from './frameLedger';

let now = 0;

beforeEach(() => {
  now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  clearLedger();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** A part that takes `ms`, running `inner` halfway. */
function part(name: string, ms: number, inner: () => void = () => undefined): void {
  timed(name, () => {
    now += ms / 2;
    inner();
    now += ms / 2;
  });
}

describe('the frame ledger (#1196)', () => {
  it('notes each part’s own time, an inner part’s taken out of the outer’s', () => {
    part('stage.camera', 10, () => {
      part('feature.empires', 30, () => {
        part('feature.empires', 4);
      });
      part('draw.timeline', 6);
    });
    part('stage.render', 8);
    expect(partsWithin(0, 100)).toEqual([
      { name: 'feature.empires', ms: 34 },
      { name: 'stage.camera', ms: 10 },
      { name: 'stage.render', ms: 8 },
      { name: 'draw.timeline', ms: 6 },
    ]);
    expect(timedWithin(0, 100)).toBe(58);
  });

  it('gives only the parts begun within the frame asked about, the longest few', () => {
    part('a', 5);
    const frame = now;
    part('b', 1);
    part('c', 3);
    part('d', 2);
    expect(partsWithin(frame, now, 2)).toEqual([
      { name: 'c', ms: 3 },
      { name: 'd', ms: 2 },
    ]);
    expect(partsWithin(now + 1, now + 2)).toEqual([]);
  });

  it('returns what the part returns, and notes it even when it throws', () => {
    expect(timed('x', () => 7)).toBe(7);
    expect(() =>
      timed('y', () => {
        now += 2;
        throw new Error('broke');
      }),
    ).toThrow('broke');
    expect(partsWithin(0, 10)).toEqual([
      { name: 'y', ms: 2 },
      { name: 'x', ms: 0 },
    ]);
  });

  it('ignores an end with nothing begun, and keeps only the latest notes', () => {
    end('stray');
    expect(partsWithin(0, 10)).toEqual([]);
    for (let index = 0; index < 5000; index += 1) {
      begin();
      now += 1;
      // The first 904 are pushed out by the 4,096 after them.
      end(index < 904 ? 'old' : 'new');
    }
    expect(partsWithin(0, now).map(({ name }) => name)).toEqual(['new']);
  });
});
