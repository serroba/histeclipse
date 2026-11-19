import { describe, expect, it, vi } from 'vitest';

import rocksFile from '../../../public/data/rocks.json';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { RESTING, type Capability, type FeatureContext } from '../feature';
import { rocksFeature } from '.';

const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'rocks', true) };
/** Central Germany: Mesozoic sedimentary rocks, 201.3 to 145 million years old. */
const germany: ViewState = { ...on, location: { latitude: 50, longitude: 10 } };
/** The middle of the Pacific: no map unit. */
const ocean: ViewState = { ...on, location: { latitude: 0, longitude: -140 } };
const JD = 2451545;

/** A context that records what the feature asks of the app (#380): no globe, no page. */
function fakeContext(options: { readonly failing?: boolean; readonly oldest?: number } = {}) {
  const refresh = vi.fn();
  const notify = vi.fn();
  const update = vi.fn();
  const enter = vi.fn();
  const travelling = vi.fn(() => false);
  const fetchJson = vi.fn(() =>
    options.failing === true
      ? Promise.reject(new Error('offline'))
      : Promise.resolve(new Response(JSON.stringify(rocksFile))),
  );
  const context = {
    base: '/',
    fetchJson,
    notify,
    refresh,
    globe: { addLayer: () => ({ update }) },
    timeline: { travelling, oldest: () => options.oldest ?? 540 },
    deepTime: { enter },
  } as unknown as FeatureContext<Capability>;
  return { context, refresh, notify, fetchJson, update, enter, travelling };
}

/** The feature mounted and shown `state`, its file in. */
async function loaded(state: ViewState, options: { readonly oldest?: number } = {}) {
  const fake = fakeContext(options);
  const shown = rocksFeature.mount(fake.context, fake.context);
  shown.show?.(state, JD);
  await vi.waitFor(() => {
    expect(fake.refresh).toHaveBeenCalledTimes(1);
  });
  shown.show?.(state, JD);
  return { ...fake, shown };
}

describe('the rocks as a feature', () => {
  it('asks for time’s playing and the way into deep time, and watches the layers, deep time and the place', () => {
    expect(rocksFeature.needs).toEqual(['timeline', 'deepTime']);
    expect(rocksFeature.watches(germany)).toEqual([germany.layers, germany.ma, germany.location]);
  });

  it('shows and says nothing while its layer is off, or in deep time', () => {
    const { context, fetchJson, update } = fakeContext();
    const shown = rocksFeature.mount(context, context);
    shown.show?.(off, JD);
    shown.show?.({ ...on, ma: 66 }, JD);
    expect(shown.said?.()).toBeNull();
    expect(shown.action?.()).toBeNull();
    expect(update).toHaveBeenLastCalledWith(null);
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('rests while the reader travels through the years', () => {
    const { context, travelling, update, fetchJson } = fakeContext();
    travelling.mockReturnValue(true);
    const shown = rocksFeature.mount(context, context);
    shown.show?.(on, JD);
    expect(shown.said?.()).toBe(RESTING);
    expect(update).toHaveBeenLastCalledWith(null);
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('says it is loading, once, then draws the rocks and asks for a place', async () => {
    const { context, refresh, fetchJson, update } = fakeContext();
    const shown = rocksFeature.mount(context, context);
    shown.show?.(on, JD);
    shown.show?.(on, JD);
    expect(shown.said?.()).toBe('Loading the rocks…');
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(fetchJson).toHaveBeenCalledWith('/data/rocks.json');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    shown.show?.(on, JD);
    expect(shown.said?.()).toBe('Pick a place on the globe to see its rock, and when it formed.');
    expect((update.mock.lastCall?.[0] as readonly unknown[]).length).toBeGreaterThan(0);
    expect(shown.action?.()).toBeNull();
  });

  it('names the rock at the place picked, and offers the Earth as it was then', async () => {
    const { shown, enter } = await loaded(germany);
    expect(shown.said?.()).toMatch(/^At the place picked: .+ million years ago\.$/);
    const action = shown.action?.();
    expect(action?.label).toMatch(/^See the Earth as it was then, /);
    action?.run();
    expect(enter).toHaveBeenCalledTimes(1);
    expect(enter).toHaveBeenLastCalledWith(173.15, 'all');
  });

  it('takes the span of all Earth’s history when the rock is older than the oldest map', async () => {
    const { shown, enter } = await loaded(germany, { oldest: 0 });
    shown.action?.()?.run();
    expect(enter).toHaveBeenLastCalledWith(173.15, 'eons');
  });

  it('says so where the map has no rock, and offers nothing', async () => {
    const { shown } = await loaded(ocean);
    expect(shown.said?.()).toBe(
      'Pick a place on the globe to see its rock; this map has none there.',
    );
    expect(shown.action?.()).toBeNull();
  });

  it('tells the reader when its file does not load, and tries again the next time', async () => {
    const { context, notify, fetchJson } = fakeContext({ failing: true });
    const shown = rocksFeature.mount(context, context);
    shown.show?.(on, JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the rocks: offline');
    });
    shown.show?.(on, JD);
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });

  it('says what is at the place picked, once loaded and on, in the years', async () => {
    const fake = fakeContext();
    const shown = rocksFeature.mount(fake.context, fake.context);
    expect(shown.here?.(germany)).toBeNull();
    shown.show?.(germany, JD);
    await vi.waitFor(() => {
      expect(fake.refresh).toHaveBeenCalledTimes(1);
    });
    expect(shown.here?.(germany)).toMatchObject({ title: 'Rocks', why: 'rocks' });
    expect(shown.here?.(ocean)?.text).toBe('No map unit of Macrostrat’s here.');
    expect(shown.here?.(on)).toBeNull();
    expect(shown.here?.({ ...germany, ma: 66 })).toBeNull();
    expect(shown.here?.({ ...germany, layers: off.layers })).toBeNull();
  });
});
