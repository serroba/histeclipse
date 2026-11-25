// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import sites from '../../../public/data/extinctions.json';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import type { MarkerCardContent } from '../../ui/markerCard';
import type { Capability, FeatureContext } from '../feature';
import { createOwnTime } from '../ownTime';
import { extinctionsFeature } from '.';

const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'extinctions', true), ma: 66 };
const JD = 2451545;

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

function fakeContext(
  options: { failing?: boolean; pace?: 'slow' | 'normal'; lessMotion?: boolean } = {},
) {
  vi.stubGlobal('matchMedia', () => ({ matches: options.lessMotion === true }));
  const drawn: unknown[] = [];
  const cards: MarkerCardContent[] = [];
  const refresh = vi.fn();
  const playing = { at: vi.fn(), end: vi.fn() };
  const strikes = {
    playImpact: vi.fn(() => playing),
    flyTo: vi.fn(),
    zoomTo: vi.fn(),
    on: document.createElement('div'),
  };
  const timeline = { playing: vi.fn(() => false) };
  const lent = {
    base: '/',
    fetchJson: () =>
      options.failing === true
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(new Response(JSON.stringify(sites))),
    globe: { addLayer: () => ({ update: (input: unknown) => drawn.push(input) }) },
    notify: vi.fn(),
    change: vi.fn(),
    cards: { show: (card: MarkerCardContent) => cards.push(card), open: () => true },
    timeline,
    strikes,
    deepTime: { hold: vi.fn(() => true), resume: vi.fn(), pace: () => options.pace ?? 'slow' },
    overPage: {
      add: (element: HTMLElement) => {
        document.body.append(element);
      },
    },
    refresh,
  } as unknown as FeatureContext<Capability>;
  const context = { ...lent, ownTime: createOwnTime(lent, lent) };
  return { context, drawn, cards, refresh, strikes, timeline };
}

async function loaded(state: ViewState, options: Parameters<typeof fakeContext>[0] = {}) {
  const fake = fakeContext(options);
  const shown = extinctionsFeature.mount(fake.context, fake.context);
  shown.show?.(state, JD);
  await vi.waitFor(() => {
    expect(fake.refresh).toHaveBeenCalled();
  });
  shown.show?.(state, JD);
  return { ...fake, shown };
}

const clockTitle = () => document.querySelector('.strike-clock')?.getAttribute('aria-label');

describe('the extinctions as a feature', () => {
  it('asks for the cards, the timeline and the shared clock, and is shown again as deep time changes', () => {
    expect(extinctionsFeature.needs).toEqual(['cards', 'timeline', 'ownTime']);
    expect(extinctionsFeature.watches(on)).toEqual([on.layers, on.mode, on.ma, on.deepScale]);
  });

  it('draws nothing, says nothing and eases nothing while its layer is off', () => {
    const { context, drawn } = fakeContext();
    const shown = extinctionsFeature.mount(context, context);
    shown.show?.(off, JD);
    expect(drawn).toEqual([null]);
    expect(shown.said?.()).toBeNull();
    expect(shown.finds?.(off)).toEqual([]);
    expect(shown.finds?.(on)).toContain(251.9);
  });

  it('says it is loading, then marks Chicxulub, the Deccan Traps and El Kef', async () => {
    const fake = fakeContext();
    const shown = extinctionsFeature.mount(fake.context, fake.context);
    shown.show?.(on, JD);
    expect(shown.said?.()).toBe('Loading the extinctions’ places…');
    // Named before they are in: nothing to open yet.
    shown.pick?.('chicxulub');
    expect(fake.cards).toEqual([]);
    await vi.waitFor(() => {
      expect(fake.refresh).toHaveBeenCalled();
    });
    shown.show?.(on, JD);
    expect(shown.said?.()).toBe('End-Cretaceous extinction');
    const marks = fake.drawn.at(-1) as readonly { site: { id: string } }[];
    expect(marks.map((mark) => mark.site.id)).toEqual(['chicxulub', 'deccan-traps', 'el-kef']);
    // Loaded: nothing to report.
    expect(shown.load?.()).toBeNull();
  });

  it('opens a place a passage named once its mark is drawn, and forgets it if another is tapped or the layer goes (#1233)', async () => {
    const fake = fakeContext();
    const shown = extinctionsFeature.mount(fake.context, fake.context);
    shown.show?.(on, JD);
    shown.pick?.('el-kef');
    await vi.waitFor(() => {
      expect(fake.refresh).toHaveBeenCalled();
    });
    shown.show?.(on, JD);
    expect(fake.cards.map((card) => card.title)).toEqual(['End-Cretaceous extinction']);
    // Shown again: the card is not opened twice.
    shown.show?.(on, JD);
    expect(fake.cards).toHaveLength(1);
    // Named, then another marker tapped: it is forgotten.
    shown.show?.({ ...on, ma: 100 }, JD);
    shown.pick?.('chicxulub');
    shown.unpick?.();
    shown.show?.(on, JD);
    expect(fake.cards).toHaveLength(1);
    // Named, then the layer off: forgotten too.
    shown.show?.({ ...on, ma: 100 }, JD);
    shown.pick?.('chicxulub');
    shown.show?.(off, JD);
    shown.show?.(on, JD);
    expect(fake.cards).toHaveLength(1);
  });

  it('watches the end-Cretaceous from a card as Chicxulub’s strike, on its clock', async () => {
    const { shown, cards, strikes } = await loaded(on);
    shown.pick?.('nowhere');
    shown.pick?.('deccan-traps');
    const card = cards.at(-1);
    expect(card?.title).toBe('End-Cretaceous extinction');
    card?.action?.run();
    expect(clockTitle()).toBe('Chicxulub, in its own time');
    expect(strikes.playImpact).toHaveBeenCalledWith(expect.objectContaining({ driven: true }));
    expect(strikes.zoomTo).toHaveBeenCalledWith(3.4);
  });

  it('watches the end-Permian from a card, the traps fuming', async () => {
    const { shown, cards, drawn, strikes } = await loaded({ ...on, ma: 252 });
    shown.pick?.('norilsk');
    cards.at(-1)?.action?.run();
    expect(clockTitle()).toBe('The end-Permian, in its own time');
    expect(strikes.zoomTo).toHaveBeenCalledWith(2.3);
    expect(drawn.at(-1)).toMatchObject({ spread: 9, fuming: { lava: 0, gas: 0, haze: 0 } });
  });

  it('watches the end-Triassic and the end-Guadalupian from their cards, each province fuming (#1201)', async () => {
    const triassic = await loaded({ ...on, ma: 201.5 });
    triassic.shown.pick?.('kuhjoch');
    triassic.cards.at(-1)?.action?.run();
    expect(clockTitle()).toBe('The end-Triassic, in its own time');
    // Centred between its lavas, now on either side of the Atlantic.
    const camp = triassic.drawn.at(-1) as { center: { longitude: number }; spread: number };
    expect(camp.spread).toBe(14);
    expect(camp.center.longitude).toBeGreaterThan(-25);
    expect(camp.center.longitude).toBeLessThan(-5);
    document.body.replaceChildren();
    const guadalupian = await loaded({ ...on, ma: 259.8 });
    guadalupian.shown.pick?.('emeishan-traps');
    guadalupian.cards.at(-1)?.action?.run();
    expect(clockTitle()).toBe('The end-Guadalupian, in its own time');
    expect(guadalupian.drawn.at(-1)).toMatchObject({ spread: 4 });
  });

  it('watches the end-Ordovician’s ice and the Late Devonian’s seas from their cards (#1202)', async () => {
    const ordovician = await loaded({ ...on, ma: 444 });
    ordovician.shown.pick?.('dobs-linn');
    ordovician.cards.at(-1)?.action?.run();
    expect(clockTitle()).toBe('The end-Ordovician, in its own time');
    expect(ordovician.drawn.at(-1)).toMatchObject({ spread: 22, seas: { ice: 14, anoxia: 0 } });
    document.body.replaceChildren();
    const devonian = await loaded({ ...on, ma: 372.2 });
    devonian.shown.pick?.('viluy-traps');
    devonian.cards.at(-1)?.action?.run();
    expect(clockTitle()).toBe('The Late Devonian, in its own time');
    expect(devonian.drawn.at(-1)).toMatchObject({ ice: null });
  });

  it('at Slow, hands over to the end-Permian’s clock as deep time plays past it, once', async () => {
    const { shown, timeline } = await loaded({ ...on, ma: 253 });
    timeline.playing.mockReturnValue(true);
    shown.show?.({ ...on, ma: 253 }, JD);
    shown.show?.({ ...on, ma: 251.8 }, JD);
    expect(clockTitle()).toBe('The end-Permian, in its own time');
    shown.show?.({ ...on, ma: 251.7 }, JD);
    expect(document.querySelectorAll('.strike-clock')).toHaveLength(1);
  });

  it('faster, offers it; for a reader who asks for less motion, or while not playing, nothing', async () => {
    const offered = await loaded({ ...on, ma: 253 }, { pace: 'normal' });
    offered.timeline.playing.mockReturnValue(true);
    offered.shown.show?.({ ...on, ma: 253 }, JD);
    offered.shown.show?.({ ...on, ma: 251.8 }, JD);
    expect(document.querySelector('.strike-offer')?.textContent).toBe(
      'Watch the end-Permian in its own time',
    );
    document.body.replaceChildren();
    for (const [options, playing] of [
      [{ lessMotion: true }, true],
      [{}, false],
    ] as const) {
      const still = await loaded({ ...on, ma: 253 }, options);
      still.timeline.playing.mockReturnValue(playing);
      still.shown.show?.({ ...on, ma: 253 }, JD);
      still.shown.show?.({ ...on, ma: 251.8 }, JD);
      expect(document.querySelector('.strike-clock, .strike-offer')).toBeNull();
    }
  });

  it('says so when the places cannot be loaded', async () => {
    const { context } = fakeContext({ failing: true });
    const shown = extinctionsFeature.mount(context, context);
    shown.show?.(on, JD);
    await vi.waitFor(() => {
      shown.show?.(on, JD);
      expect(shown.said?.()).toBe('Could not load the extinctions’ places.');
    });
  });
});
