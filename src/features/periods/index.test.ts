import { describe, expect, it, vi } from 'vitest';

import periods from '../../../public/data/periods.json';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import type { Capability, FeatureContext } from '../feature';
import { periodsFeature } from '.';

const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'periods', true) };
/** Athens in 1500 BCE: the Bronze Age, by several sources. */
const athens: ViewState = {
  ...on,
  time: moveToYear(on.time, astronomicalYear(-1499)),
  location: { latitude: 37.98, longitude: 23.73 },
};
const JD = 2451545;

/** A context that records what the feature asks of the app (#380): no globe, no page. */
function fakeContext(options: { readonly failing?: boolean } = {}) {
  const refresh = vi.fn();
  const notify = vi.fn();
  const fetchJson = vi.fn(() =>
    options.failing === true
      ? Promise.reject(new Error('offline'))
      : Promise.resolve(new Response(JSON.stringify(periods))),
  );
  const context = {
    base: '/',
    fetchJson,
    notify,
    refresh,
  } as unknown as FeatureContext<Capability>;
  return { context, refresh, notify, fetchJson };
}

describe('the named periods as a feature', () => {
  it('asks for nothing beyond the core, and is shown again for the layers, deep time or the place', () => {
    expect(periodsFeature.needs).toEqual([]);
    expect(periodsFeature.watches(athens)).toEqual([athens.layers, athens.ma, athens.location]);
  });

  it('says nothing while its layer is off, or in deep time', () => {
    const { context, fetchJson } = fakeContext();
    const shown = periodsFeature.mount(context, context);
    shown.show?.(off, JD);
    expect(shown.said?.()).toBeNull();
    shown.show?.({ ...on, ma: 66 }, JD);
    expect(shown.said?.()).toBeNull();
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('says it is loading, once, then names the periods of the place picked', async () => {
    const { context, refresh, fetchJson } = fakeContext();
    const shown = periodsFeature.mount(context, context);
    shown.show?.(athens, JD);
    shown.show?.(athens, JD);
    expect(shown.said?.()).toBe('Loading the named periods…');
    expect(fetchJson).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    shown.show?.(athens, JD);
    expect(shown.said?.()).toContain('Bronze Age');
  });

  it('asks for a place where none is picked', async () => {
    const { context, refresh } = fakeContext();
    const shown = periodsFeature.mount(context, context);
    shown.show?.(on, JD);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    shown.show?.({ ...on, location: null }, JD);
    expect(shown.said?.()).toBe('Pick a place on land to see the periods named there.');
  });

  it('says so when the periods cannot be loaded, waits on its chip, and tries again from there (#762)', async () => {
    const { context, notify, fetchJson } = fakeContext({ failing: true });
    const shown = periodsFeature.mount(context, context);
    shown.show?.(athens, JD);
    expect(shown.load?.()).toEqual({ state: 'loading' });
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the named periods: offline');
    });
    shown.show?.(athens, JD);
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(shown.said?.()).toBe('Could not load the named periods.');
    const failed = shown.load?.();
    if (failed?.state !== 'failed') throw new Error('expected a failed load');
    failed.retry();
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });
});
