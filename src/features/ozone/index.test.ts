import { describe, expect, it, vi } from 'vitest';

import history from '../../../public/data/ozone/history.json';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import type { FeatureContext } from '../feature';
import { ozoneLayer } from './ozoneLayer';
import { ozoneFeature } from '.';

const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'ozone', true) };
const inYear = (year: number): ViewState => ({
  ...on,
  time: moveToYear(on.time, astronomicalYear(year)),
});
const JD = 2451545;

/** A context that records what the feature draws: the cap and the panel apart. */
function fakeContext(options: { readonly failures?: number } = {}) {
  let failures = options.failures ?? 0;
  const caps: unknown[] = [];
  const panels: unknown[] = [];
  const refresh = vi.fn();
  const notify = vi.fn();
  const context = {
    base: '/',
    fetchJson: () => {
      failures -= 1;
      return failures >= 0
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(new Response(JSON.stringify(history)));
    },
    globe: {
      addLayer: (factory: unknown) => ({
        update: (input: unknown) => (factory === ozoneLayer ? caps : panels).push(input),
      }),
    },
    notify,
    refresh,
  } as unknown as FeatureContext;
  return { context, caps, panels, refresh, notify };
}

describe('the ozone layer as a feature', () => {
  it('Given the layer off, Then nothing is drawn or said', () => {
    const { context, caps, panels } = fakeContext();
    const shown = ozoneFeature.mount(context);
    shown.show?.({ ...inYear(2006), layers: off.layers }, JD);
    expect(caps).toEqual([null]);
    expect(panels).toEqual([null]);
    expect(shown.said?.()).toBeNull();
  });

  it('Given it on, Then it loads once, and draws each year’s hole, leaving 1995 and years outside empty', async () => {
    const { context, caps, panels, refresh } = fakeContext();
    const shown = ozoneFeature.mount(context);
    shown.show?.(inYear(2006), JD);
    expect(shown.said?.()).toBe('Loading the ozone record…');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
    });
    shown.show?.(inYear(2006), JD);
    expect(caps.at(-1)).toBe(26.6);
    expect(panels.at(-1)).toMatchObject({
      text: '2006: 26.6 million km², lowest 98 DU.',
    });
    // The same year again draws nothing new.
    const drawn = caps.length;
    shown.show?.(inYear(2006), JD);
    expect(caps).toHaveLength(drawn);
    shown.show?.(inYear(1995), JD);
    expect(caps.at(-1)).toBeNull();
    expect(shown.said?.()).toMatch(/No satellite measured/);
    shown.show?.(inYear(1900), JD);
    expect(caps.at(-1)).toBeNull();
    // In deep time it rests.
    shown.show?.({ ...on, ma: 100 }, JD);
    expect(caps.at(-1)).toBeNull();
    expect(panels.at(-1)).toBeNull();
  });

  it('Given it on, Then its load is said loading until the record arrives, and nothing once drawn', async () => {
    const { context, refresh } = fakeContext();
    const shown = ozoneFeature.mount(context);
    expect(shown.load?.()).toBeNull();
    shown.show?.(inYear(2006), JD);
    expect(shown.load?.()).toEqual({ state: 'loading' });
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
    });
    expect(shown.load?.()).toBeNull();
  });

  it('Given the record does not load, Then it says so, waits rather than trying at each moment, and loads when tried again (#751)', async () => {
    const { context, notify, refresh, caps } = fakeContext({ failures: 1 });
    const shown = ozoneFeature.mount(context);
    shown.show?.(inYear(2006), JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the ozone record: offline');
    });
    expect(refresh).toHaveBeenCalledOnce();
    const failed = shown.load?.();
    expect(failed?.state).toBe('failed');
    shown.show?.(inYear(2006), JD);
    shown.show?.(inYear(2007), JD);
    expect(shown.said?.()).toBe('Could not load the ozone record.');
    expect(notify).toHaveBeenCalledOnce();
    if (failed?.state === 'failed') failed.retry();
    expect(shown.load?.()).toEqual({ state: 'loading' });
    shown.show?.(inYear(2007), JD);
    expect(shown.said?.()).toBe('Loading the ozone record…');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(3);
    });
    shown.show?.(inYear(2007), JD);
    expect(caps.at(-1)).toEqual(expect.any(Number));
    expect(notify).toHaveBeenCalledOnce();
  });
});
