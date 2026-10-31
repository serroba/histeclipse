import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { serializeViewState } from './url';
import { browserUrlWriter, createUrlSync } from './urlSync';
import { defaultViewState, type ViewState } from './viewState';

const NOW = new Date(Date.UTC(2025, 2, 14, 7, 0));
const base = defaultViewState(NOW);
const sky: ViewState = { ...base, mode: 'sky' };

describe('createUrlSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes the latest state once the interval has passed', () => {
    const writes: string[] = [];
    const sync = createUrlSync({ replace: (query) => writes.push(query) }, 100);
    sync.update(base);
    vi.advanceTimersByTime(50);
    sync.update(sky);
    vi.advanceTimersByTime(49);
    expect(writes).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(writes).toEqual([serializeViewState(sky)]);
  });

  it('keeps writing during continuous changes instead of waiting for them to stop', () => {
    const writes: string[] = [];
    const sync = createUrlSync({ replace: (query) => writes.push(query) }, 100);
    // A globe gliding after a flick: a change every 20 ms for two seconds.
    for (let step = 0; step < 100; step += 1) {
      const longitude = step / 10;
      sync.update({ ...base, camera: { ...base.camera, target: { latitude: 0, longitude } } });
      vi.advanceTimersByTime(20);
    }
    expect(writes.length).toBeGreaterThanOrEqual(19);
    expect(writes.length).toBeLessThanOrEqual(21);
    vi.runAllTimers();
    expect(writes.at(-1)).toContain('cam=0.0000,9.9000,');
  });

  it('skips writes that would not change the URL', () => {
    const writes: string[] = [];
    const sync = createUrlSync({ replace: (query) => writes.push(query) });
    sync.update(base);
    sync.flush();
    sync.update({ ...base });
    sync.flush();
    expect(writes).toHaveLength(1);
  });

  it('flushes immediately on request and does nothing when idle', () => {
    const writes: string[] = [];
    const sync = createUrlSync({ replace: (query) => writes.push(query) });
    sync.flush();
    sync.update(sky);
    sync.flush();
    expect(writes).toEqual([serializeViewState(sky)]);
  });

  it('drops pending writes when disposed', () => {
    const writes: string[] = [];
    const sync = createUrlSync({ replace: (query) => writes.push(query) });
    sync.update(sky);
    sync.dispose();
    sync.dispose();
    vi.runAllTimers();
    expect(writes).toEqual([]);
  });
});

describe('browserUrlWriter', () => {
  it('replaces the query, keeping path and hash, without adding history', () => {
    const calls: unknown[][] = [];
    const history = {
      state: { kept: true },
      replaceState: (...args: unknown[]) => calls.push(args),
    } as unknown as History;
    const location = { pathname: '/histeclipse/', hash: '#about' } as Location;
    browserUrlWriter(location, history).replace('v=1&mode=sky');
    expect(calls).toEqual([[{ kept: true }, '', '/histeclipse/?v=1&mode=sky#about']]);
  });
});
