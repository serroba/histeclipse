import { describe, expect, it, vi } from 'vitest';

import waysFile from '../../../public/data/ways-of-life.json';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import type { Capability, FeatureContext } from '../feature';
import { waysFeature } from '.';

const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'ways', true) };
const at = (state: ViewState, year: number): ViewState => ({
  ...state,
  time: moveToYear(state.time, astronomicalYear(year)),
});
/** 3500 BCE: ArchaeoGLOBE's nearest moment is 4051 BCE. */
const ancient = at(on, -3499);
const JD = 2451545;

/** A context that records what the feature asks of the app (#380): no globe, no page. */
function fakeContext(options: { readonly failing?: boolean } = {}) {
  const refresh = vi.fn();
  const notify = vi.fn();
  const update = vi.fn();
  const render = vi.fn();
  const fetchJson = vi.fn(() =>
    options.failing === true
      ? Promise.reject(new Error('offline'))
      : Promise.resolve(new Response(JSON.stringify(waysFile))),
  );
  const context = {
    base: '/',
    fetchJson,
    notify,
    refresh,
    globe: { addLayer: () => ({ update }) },
    waysKey: { render },
  } as unknown as FeatureContext<Capability>;
  return { context, refresh, notify, fetchJson, update, render };
}

/** The feature mounted and shown `state`, its file in. */
async function loaded(state: ViewState) {
  const fake = fakeContext();
  const shown = waysFeature.mount(fake.context, fake.context);
  shown.show?.(state, JD);
  await vi.waitFor(() => {
    expect(fake.refresh).toHaveBeenCalledTimes(1);
  });
  shown.show?.(state, JD);
  return { ...fake, shown };
}

describe('the ways of life as a feature', () => {
  it('asks for its key under the years, and is shown again for the layers or deep time', () => {
    expect(waysFeature.needs).toEqual(['waysKey']);
    expect(waysFeature.watches(ancient)).toEqual([ancient.layers, ancient.ma]);
  });

  it('shows and says nothing while its layer is off, or in deep time', () => {
    const { context, fetchJson, update, render } = fakeContext();
    const shown = waysFeature.mount(context, context);
    shown.show?.(off, JD);
    shown.show?.({ ...on, ma: 66 }, JD);
    expect(shown.said?.()).toBeNull();
    expect(update).toHaveBeenLastCalledWith(null);
    expect(render).toHaveBeenLastCalledWith(null);
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('says it is loading, once, then shades the regions and shows their key', async () => {
    const { context, refresh, fetchJson, update, render } = fakeContext();
    const shown = waysFeature.mount(context, context);
    shown.show?.(ancient, JD);
    shown.show?.(ancient, JD);
    expect(shown.said?.()).toBe('Loading the ways of life…');
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(fetchJson).toHaveBeenCalledWith('/data/ways-of-life.json');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    shown.show?.(ancient, JD);
    expect(shown.said?.()).toMatch(/^As rated for 4051 BCE, the nearest moment ArchaeoGLOBE rates/);
    const regions = update.mock.lastCall?.[0] as readonly unknown[];
    expect(regions.length).toBeGreaterThan(0);
    expect(render).toHaveBeenLastCalledWith(expect.objectContaining({ regions }));
  });

  it('paints the map again only when the moment rated changes', async () => {
    const { shown, update } = await loaded(ancient);
    const painted = update.mock.calls.length;
    // A year on, the nearest moment rated is the same.
    shown.show?.(at(on, -3498), JD);
    expect(update).toHaveBeenCalledTimes(painted);
    shown.show?.(at(on, 1840), JD);
    expect(update).toHaveBeenCalledTimes(painted + 1);
    expect(shown.said?.()).toMatch(/^As rated for 1850 CE/);
  });

  it('takes the shading and the key away when the layer is turned off', async () => {
    const { shown, update, render } = await loaded(ancient);
    shown.show?.(off, JD);
    expect(update).toHaveBeenLastCalledWith(null);
    expect(render).toHaveBeenLastCalledWith(null);
    expect(shown.said?.()).toBeNull();
  });

  it('tells the reader when its file does not load, and tries again the next time', async () => {
    const { context, notify, fetchJson } = fakeContext({ failing: true });
    const shown = waysFeature.mount(context, context);
    shown.show?.(ancient, JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the ways of life: offline');
    });
    shown.show?.(ancient, JD);
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });

  it('says what is rated at the place picked, once loaded and on, in the years', async () => {
    const place = { latitude: 30, longitude: 31 };
    const there = { ...ancient, location: place };
    const fake = fakeContext();
    const shown = waysFeature.mount(fake.context, fake.context);
    expect(shown.here?.(there)).toBeNull();
    shown.show?.(there, JD);
    await vi.waitFor(() => {
      expect(fake.refresh).toHaveBeenCalledTimes(1);
    });
    const fact = shown.here?.(there);
    expect(fact?.title).toBe('Ways of life');
    expect(fact?.text).toContain('4051 BCE');
    expect(fact?.why).toBe('ways');
    expect(shown.here?.(ancient)).toBeNull();
    expect(shown.here?.({ ...there, ma: 66 })).toBeNull();
    expect(shown.here?.({ ...there, layers: off.layers })).toBeNull();
  });
});
