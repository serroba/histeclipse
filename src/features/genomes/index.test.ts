import { describe, expect, it, vi } from 'vitest';

import genomes from '../../../public/data/genomes/aadr.json';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import type { MarkerCardContent } from '../../ui/markerCard';
import { RESTING, type FeatureContext } from '../feature';
import { genomesFeature } from '.';

const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'genomes', true) };
/** The Bronze Age: many genomes sequenced. */
const bronzeAge: ViewState = { ...on, time: moveToYear(on.time, astronomicalYear(-2499)) };
const JD = 2451545;

/** A context that records what the feature asks of the app (#380): no globe, no page. */
function fakeContext(options: { readonly failing?: boolean; readonly travelling?: boolean } = {}) {
  const drawn: unknown[] = [];
  const cards: MarkerCardContent[] = [];
  const refresh = vi.fn();
  const notify = vi.fn();
  const context = {
    base: '/',
    fetchJson: () =>
      options.failing === true
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(new Response(JSON.stringify(genomes))),
    globe: { addLayer: () => ({ update: (input: unknown) => drawn.push(input) }) },
    notify,
    showCard: (card: MarkerCardContent) => cards.push(card),
    travelling: () => options.travelling === true,
    refresh,
  } as unknown as FeatureContext;
  return { context, drawn, cards, refresh, notify };
}

describe('the ancient genomes as a feature', () => {
  it('is shown again when the layers or deep time change', () => {
    expect(genomesFeature.watches(on)).toEqual([on.layers, on.ma]);
  });

  it('draws nothing and says nothing while its layer is off, or in deep time', () => {
    const { context, drawn } = fakeContext();
    const shown = genomesFeature.mount(context);
    shown.show(off, JD);
    shown.show({ ...on, ma: 100 }, JD);
    expect(drawn).toEqual([null]);
    expect(shown.said?.()).toBeNull();
  });

  it('rests while the reader travels through the years', () => {
    const { context, drawn } = fakeContext({ travelling: true });
    const shown = genomesFeature.mount(context);
    shown.show(bronzeAge, JD);
    expect(drawn).toEqual([null]);
    expect(shown.said?.()).toBe(RESTING);
  });

  it('loads once, then counts the genomes near the year by region, each to tap', async () => {
    const { context, drawn, cards, refresh } = fakeContext();
    const shown = genomesFeature.mount(context);
    shown.show(bronzeAge, JD);
    expect(shown.said?.()).toBe('Loading the ancient genomes…');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    shown.show(bronzeAge, JD);
    const cells = drawn[0] as readonly { cell: number; count: number }[];
    expect(cells.length).toBeGreaterThan(10);
    expect(shown.said?.()).toMatch(/genomes dated/);
    // Another moment of the same year draws nothing new.
    shown.show(bronzeAge, JD + 0.5);
    expect(drawn).toHaveLength(1);

    const first = cells[0];
    if (first === undefined) throw new Error('no cell');
    shown.pick?.(String(first.cell));
    expect(cards).toHaveLength(1);
  });

  it('opens no card before the genomes load', () => {
    const { context, cards } = fakeContext();
    genomesFeature.mount(context).pick?.('1');
    expect(cards).toEqual([]);
  });

  it('says so when the genomes cannot be loaded, and tries again next time', async () => {
    const { context, notify } = fakeContext({ failing: true });
    const shown = genomesFeature.mount(context);
    shown.show(bronzeAge, JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the ancient genomes: offline');
    });
    shown.show(bronzeAge, JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledTimes(2);
    });
  });
});
