import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { serializeViewState } from './url';
import { browserUrlWriter, createUrlSync, isStep, type UrlWriter } from './urlSync';
import { defaultViewState, type ViewState } from './viewState';

const NOW = new Date(Date.UTC(2025, 2, 14, 7, 0));
const base = defaultViewState(NOW);
const sky: ViewState = { ...base, mode: 'sky' };
const turned: ViewState = { ...base, camera: { ...base.camera, distance: 3 } };

/** A writer that records replaced queries; a new history entry would be recorded as such. */
function replacing(writes: string[]): UrlWriter {
  return {
    replace: (query) => writes.push(query),
    push: (query) => writes.push(`push ${query}`),
  };
}

describe('createUrlSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes the latest state once the interval has passed', () => {
    const writes: string[] = [];
    const sync = createUrlSync(replacing(writes), 100);
    sync.update(base);
    vi.advanceTimersByTime(50);
    sync.update(turned);
    vi.advanceTimersByTime(49);
    expect(writes).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(writes).toEqual([serializeViewState(turned)]);
  });

  it('keeps writing during continuous changes instead of waiting for them to stop', () => {
    const writes: string[] = [];
    const sync = createUrlSync(replacing(writes), 100);
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
    const sync = createUrlSync(replacing(writes));
    sync.update(base);
    sync.flush();
    sync.update({ ...base });
    sync.flush();
    expect(writes).toHaveLength(1);
  });

  it('flushes immediately on request and does nothing when idle', () => {
    const writes: string[] = [];
    const sync = createUrlSync(replacing(writes));
    sync.flush();
    sync.update(sky);
    sync.flush();
    expect(writes).toEqual([serializeViewState(sky)]);
  });

  it('starts a new history entry for a step, settling the one it leaves', () => {
    const writes: string[] = [];
    const sync = createUrlSync(replacing(writes), 100);
    sync.update(base);
    sync.update(turned);
    sync.update({ ...turned, mode: 'sky' });
    expect(writes).toEqual([
      serializeViewState(turned),
      `push ${serializeViewState({ ...turned, mode: 'sky' })}`,
    ]);
    // A step back to what is already written adds nothing.
    sync.adopt(turned);
    sync.update(turned);
    vi.runAllTimers();
    expect(writes).toHaveLength(2);
  });

  it('counts views, eclipses and entering deep time as steps, not turning the globe', () => {
    expect(isStep(base, turned)).toBe(false);
    expect(isStep(base, { ...base, time: { ...base.time, minuteOfDay: 3 } })).toBe(false);
    expect(isStep(base, sky)).toBe(true);
    expect(isStep(base, { ...base, ma: 250 })).toBe(true);
    expect(isStep({ ...base, ma: 250 }, { ...base, ma: 100 })).toBe(false);
    expect(isStep(base, { ...base, years: 'hebrew' })).toBe(true);
  });

  it('counts turning a layer on or off as a step, not the same layers in a new set', () => {
    expect(isStep(base, { ...base, layers: new Set([...base.layers, 'temperature']) })).toBe(true);
    expect(isStep(base, { ...base, layers: new Set(base.layers) })).toBe(false);
    const swapped = new Set(base.layers);
    const [first] = swapped;
    if (first !== undefined) swapped.delete(first);
    swapped.add('plates');
    expect(isStep(base, { ...base, layers: swapped })).toBe(true);
  });

  it('counts opening, closing and moving about the tree of life as steps', () => {
    expect(isStep(base, { ...base, tree: 'all' })).toBe(true);
    expect(isStep({ ...base, tree: 'all' }, base)).toBe(true);
    expect(isStep({ ...base, tree: { ott: 1 } }, { ...base, tree: { ott: 2 } })).toBe(true);
    expect(isStep({ ...base, tree: { ott: 1 } }, { ...base, tree: { ott: 1 } })).toBe(false);
    expect(isStep({ ...base, tree: 'all' }, { ...base, tree: 'all' })).toBe(false);
  });

  it('counts opening, closing and picking a crater in the impacts’ paths as steps', () => {
    expect(isStep(base, { ...base, craters: 'all' })).toBe(true);
    expect(isStep({ ...base, craters: { id: 1 } }, { ...base, craters: { id: 2 } })).toBe(true);
    expect(isStep({ ...base, craters: { id: 1 } }, { ...base, craters: { id: 1 } })).toBe(false);
  });

  it('makes the next update a step when asked, as for a jump to a milestone', () => {
    const writes: string[] = [];
    const sync = createUrlSync(replacing(writes), 100);
    const deep = { ...base, ma: 250 };
    sync.update(deep);
    sync.step();
    sync.update({ ...deep, ma: 66 });
    // Only that one: the next small change replaces again.
    sync.update({ ...deep, ma: 65 });
    vi.runAllTimers();
    expect(writes).toEqual([
      serializeViewState(deep),
      `push ${serializeViewState({ ...deep, ma: 66 })}`,
      serializeViewState({ ...deep, ma: 65 }),
    ]);
  });

  it('drops pending writes when disposed', () => {
    const writes: string[] = [];
    const sync = createUrlSync(replacing(writes));
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

  it('adds a history entry for a step', () => {
    const calls: unknown[][] = [];
    const history = { pushState: (...args: unknown[]) => calls.push(args) } as unknown as History;
    const location = { pathname: '/histeclipse/', hash: '' } as Location;
    browserUrlWriter(location, history).push('v=1&mode=sky');
    expect(calls).toEqual([[null, '', '/histeclipse/?v=1&mode=sky']]);
  });
});
