// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import impactsFile from '../../../public/data/impacts.json';
import impactPictures from '../../../public/data/impact-pictures.json';
import { loadPictures } from '../../data/pictures';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import type { DeepChipView } from '../../ui/deepChips';
import { RESTING, type Capability, type FeatureContext, type FeatureInstance } from '../feature';
import { impactsFeature } from '.';

const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'impacts', true) };
/** Just after Chicxulub (66.04 Ma), on the span of the elevation maps. */
const cretaceous: ViewState = { ...on, ma: 66, deepScale: 'all' };
const JD = 2451545;
const CHICXULUB = '26';

/** A context that records what the feature asks of the app (#380): no globe, no page. */
/** The craters' photos (#1088): Chicxulub's, by its id. */
const PICTURES = {
  schemaVersion: 1,
  credit: 'Wikipedia and Wikimedia Commons',
  made: '2026-11-22',
  pictures: {
    [CHICXULUB]: {
      page: 'https://en.wikipedia.org/wiki/Chicxulub_crater',
      image: {
        src: 'https://upload.wikimedia.org/thumb/320px-Chicxulub.jpg',
        width: 320,
        height: 240,
        artist: 'NASA',
        licence: 'Public domain',
        licenceUrl: null,
        filePage: 'https://commons.wikimedia.org/wiki/File:Chicxulub.jpg',
      },
    },
  },
};

function fakeContext(
  options: {
    readonly failing?: boolean;
    readonly noPictures?: boolean;
    readonly cardOpen?: boolean;
  } = {},
) {
  const refresh = vi.fn();
  const notify = vi.fn();
  const update = vi.fn();
  const show = vi.fn();
  const goTo = vi.fn();
  const strikes = {
    playImpact: vi.fn(),
    flyTo: vi.fn(),
    zoomTo: vi.fn(),
    on: document.createElement('div'),
  };
  const timeline = {
    travelling: vi.fn(() => false),
    playing: vi.fn(() => false),
    oldest: () => 540,
  };
  let view: ViewState = on;
  const change = vi.fn((next: (state: ViewState) => ViewState) => {
    view = next(view);
  });
  const fetchJson = vi.fn((url: string) => {
    const photos = url.endsWith('impact-pictures.json');
    if (options.failing === true || (photos && options.noPictures === true))
      return Promise.reject(new Error('offline'));
    return Promise.resolve(new Response(JSON.stringify(photos ? PICTURES : impactsFile)));
  });
  const context = {
    base: '/',
    fetchJson,
    notify,
    refresh,
    change,
    globe: { addLayer: () => ({ update }) },
    cards: { show, open: () => options.cardOpen ?? true },
    timeline,
    deepTime: { goTo },
    strikes,
  } as unknown as FeatureContext<Capability>;
  return {
    context,
    refresh,
    notify,
    fetchJson,
    update,
    show,
    goTo,
    strikes,
    timeline,
    change,
    view: () => view,
    setView: (next: ViewState) => {
      view = next;
    },
  };
}

/** The feature mounted and shown `state`, the craters in. */
async function loaded(state: ViewState, options: Parameters<typeof fakeContext>[0] = {}) {
  const fake = fakeContext(options);
  const shown = impactsFeature.mount(fake.context, fake.context);
  shown.show?.(state, JD);
  await vi.waitFor(() => {
    expect(fake.refresh).toHaveBeenCalledTimes(1);
  });
  shown.show?.(state, JD);
  return { ...fake, shown };
}

const moment = (state: ViewState) => ({ ma: state.ma ?? 0, scale: state.deepScale });

/** The feature's chip in deep time's bar at `state`. */
function chipOf(shown: FeatureInstance, state: ViewState): DeepChipView {
  const chip = shown.deep?.(state, moment(state)) ?? null;
  if (chip === null) throw new Error('no chip');
  return chip;
}

describe('the impact craters as a feature', () => {
  it('names what it asks for, picks craters, and puts its chip after the others', () => {
    expect(impactsFeature.needs).toEqual(['cards', 'timeline', 'deepTime', 'strikes']);
    expect(impactsFeature.picks).toBe('impact');
    expect(impactsFeature.deepChip).toMatchObject({ label: 'Impacts', why: 'impacts' });
    expect(impactsFeature.deepChipOrder).toBe(1);
    expect(impactsFeature.watches(on)).toEqual([on.layers, on.mode, on.ma, on.deepScale, on.focus]);
  });

  it('draws and says nothing while its layer is off, and rests while travelling through the years', () => {
    const { context, update, fetchJson, timeline } = fakeContext();
    const shown = impactsFeature.mount(context, context);
    shown.show?.(off, JD);
    expect(shown.said?.()).toBeNull();
    timeline.travelling.mockReturnValue(true);
    shown.show?.(on, JD);
    expect(shown.said?.()).toBe(RESTING);
    expect(update).toHaveBeenLastCalledWith(null);
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('says it is loading, once, then marks the craters there are today', async () => {
    const { context, refresh, fetchJson, update } = fakeContext();
    const shown = impactsFeature.mount(context, context);
    shown.show?.(on, JD);
    shown.show?.(on, JD);
    expect(shown.said?.()).toBe('Loading the impact craters…');
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(fetchJson).toHaveBeenCalledWith('/data/impacts.json');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    shown.show?.(on, JD);
    expect((update.mock.lastCall?.[0] as readonly unknown[]).length).toBeGreaterThan(100);
    expect(shown.said?.()).toMatch(/\d+/);
  });

  it('gives its chip in deep time, with the choice of which impacts to show', async () => {
    const { shown, refresh } = await loaded(cretaceous);
    expect(shown.deep?.(cretaceous, null)).toBeNull();
    const chip = chipOf(shown, cretaceous);
    expect(chip).toMatchObject({ offered: true, on: true });
    // In deep time the Layers panel says nothing: the chip does.
    expect(shown.said?.()).toBeNull();
    const [choice] = chip.note ?? [];
    if (typeof choice !== 'object' || !('choose' in choice)) throw new Error('no choice');
    expect(choice.choose.value).toBe('around');
    choice.choose.pick('struck');
    expect(refresh).toHaveBeenCalledTimes(2);
    const again = chipOf(shown, cretaceous);
    const [next] = again.note ?? [];
    if (typeof next !== 'object' || !('choose' in next)) throw new Error('no choice');
    expect(next.choose.value).toBe('struck');
  });

  it('says its chip is loading until the craters are in, and is not offered on the eons', () => {
    const { context } = fakeContext();
    const shown = impactsFeature.mount(context, context);
    const chip = chipOf(shown, cretaceous);
    expect(JSON.stringify(chip.note)).toContain('Impacts: loading…');
    const eons: ViewState = { ...on, ma: 3000, deepScale: 'eons' };
    expect(shown.deep?.(eons, moment(eons))).toMatchObject({ offered: false, on: false });
  });

  it('strikes a crater as deep time plays past it, and writes that it did', async () => {
    const { shown, timeline, strikes } = await loaded({ ...cretaceous, ma: 67 });
    timeline.playing.mockReturnValue(true);
    const facing: ViewState = {
      ...cretaceous,
      camera: { ...cretaceous.camera, target: { latitude: 21, longitude: -89 } },
    };
    shown.show?.({ ...facing, ma: 67 }, JD);
    shown.show?.({ ...facing, ma: 65.5 }, JD);
    expect(strikes.playImpact).toHaveBeenCalled();
    expect(strikes.on.dataset['strikes']).toContain('Chicxulub');
  });

  it('opens a crater’s card when its marker is tapped, with the way to when it struck', async () => {
    const { shown, show, goTo } = await loaded(on);
    shown.pick?.('no-such');
    expect(show).not.toHaveBeenCalled();
    shown.pick?.(CHICXULUB);
    const card = show.mock.lastCall?.[0] as {
      readonly title: string;
      readonly related: readonly { readonly run: () => void }[];
    };
    expect(card.title).toContain('Chicxulub');
    expect(card.related).toHaveLength(1);
    card.related[0]?.run();
    expect(goTo).toHaveBeenCalledWith(expect.any(Number), 'impacts', expect.any(Object));
  });

  it('shows a crater’s photo and its page once they come, on the card still open (#1088)', async () => {
    const { shown, show } = await loaded(on);
    shown.pick?.(CHICXULUB);
    await vi.waitFor(() => {
      expect(show).toHaveBeenCalledTimes(2);
    });
    const card = show.mock.lastCall?.[0] as {
      readonly image: { readonly credit: string };
      readonly links: readonly { readonly label: string }[];
    };
    expect(card.image.credit).toBe('Picture: NASA, Public domain, via Wikimedia Commons.');
    expect(card.links.map((link) => link.label)).toContain('Wikipedia');
    // Loaded once: the next card has its photo at once.
    shown.pick?.(CHICXULUB);
    expect(show).toHaveBeenCalledTimes(3);
    expect((show.mock.lastCall?.[0] as { image?: unknown }).image).toBeDefined();
  });

  it('has photos only for craters there are, each with a free licence (#1088)', async () => {
    const real = await loadPictures('x', () => Promise.resolve(Response.json(impactPictures)));
    const ids = new Set(impactsFile.impacts.map((impact) => String(impact.id)));
    const entries = Object.entries(real.pictures);
    expect(entries.filter(([, entry]) => entry.image !== null).length).toBeGreaterThan(80);
    for (const [id, entry] of entries) {
      expect(ids.has(id)).toBe(true);
      if (entry.image !== null) expect(entry.image.licence).toMatch(/^(CC|Public domain)/);
    }
  });

  it('opens no card again when it was closed, or let go, before the photos came (#1088)', async () => {
    const closed = await loaded(on, { cardOpen: false });
    closed.shown.pick?.(CHICXULUB);
    await vi.waitFor(() => {
      expect(closed.fetchJson).toHaveBeenCalledTimes(2);
    });
    await Promise.resolve();
    expect(closed.show).toHaveBeenCalledTimes(1);
    const letGo = await loaded(on);
    letGo.shown.pick?.(CHICXULUB);
    letGo.shown.unpick?.();
    await vi.waitFor(() => {
      expect(letGo.fetchJson).toHaveBeenCalledTimes(2);
    });
    await Promise.resolve();
    expect(letGo.show).toHaveBeenCalledTimes(1);
  });

  it('says so when the photos do not load, and asks again with the next card (#1088)', async () => {
    const { shown, notify, fetchJson } = await loaded(on, { noPictures: true });
    shown.pick?.(CHICXULUB);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the craters’ photos: offline');
    });
    shown.pick?.(CHICXULUB);
    expect(fetchJson).toHaveBeenCalledTimes(3);
  });

  it('plays a crater from its card: back to Earth, turned to it, close, then the strike', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      const { shown, show, strikes, view, setView } = await loaded(on);
      setView({ ...on, focus: 'moon', camera: { ...on.camera, distance: 5 } });
      shown.pick?.(CHICXULUB);
      const card = show.mock.lastCall?.[0] as { readonly action: { readonly run: () => void } };
      card.action.run();
      expect(view().focus).toBe('earth');
      expect(strikes.flyTo).toHaveBeenCalledTimes(1);
      expect(strikes.zoomTo).toHaveBeenCalledWith(2.2);
      expect(strikes.playImpact).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1000);
      expect(strikes.playImpact).toHaveBeenCalledTimes(1);
      // Already nearer than that, the view stays as near as it is.
      setView({ ...on, camera: { ...on.camera, distance: 1.5 } });
      card.action.run();
      expect(strikes.zoomTo).toHaveBeenLastCalledWith(1.5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('offers the craters’ paths through time from the Layers panel', () => {
    const { context, view } = fakeContext();
    const shown = impactsFeature.mount(context, context);
    const action = shown.action?.();
    expect(action?.label).toBe('Their paths through time, in 3D');
    action?.run();
    expect(view().craters).toBe('all');
  });

  it('tells the reader when the craters do not load, waits on its chip, and tries again from there (#762)', async () => {
    const { context, notify, fetchJson } = fakeContext({ failing: true });
    const shown = impactsFeature.mount(context, context);
    shown.show?.(on, JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the impact craters: offline');
    });
    shown.show?.(on, JD);
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(shown.said?.()).toBe('Could not load the impact craters.');
    const failed = shown.load?.();
    if (failed?.state !== 'failed') throw new Error('expected a failed load');
    failed.retry();
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });
});
