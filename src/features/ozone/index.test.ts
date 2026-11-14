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
function fakeContext(options: { readonly failing?: boolean } = {}) {
  const caps: unknown[] = [];
  const panels: unknown[] = [];
  const refresh = vi.fn();
  const notify = vi.fn();
  const context = {
    base: '/',
    fetchJson: () =>
      options.failing === true
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(new Response(JSON.stringify(history))),
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
      text: expect.stringContaining('spring of 2006') as unknown,
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

  it('Given the record does not load, Then it says so and tries again next time', async () => {
    const { context, notify } = fakeContext({ failing: true });
    const shown = ozoneFeature.mount(context);
    shown.show?.(inYear(2006), JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the ozone record: offline');
    });
    shown.show?.(inYear(2006), JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledTimes(2);
    });
  });
});
