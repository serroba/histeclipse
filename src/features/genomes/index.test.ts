import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import genomes from '../../../public/data/genomes/aadr.json';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import type { MarkerCardContent } from '../../ui/markerCard';
import type { Capability, FeatureContext } from '../feature';
import { genomesFeature } from '.';

const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'genomes', true) };
/** The Bronze Age: many genomes sequenced. */
const bronzeAge: ViewState = { ...on, time: moveToYear(on.time, astronomicalYear(-2499)) };
const JD = 2451545;

/** A context that records what the feature asks of the app (#380): no globe, no page. */
function fakeContext(
  options: {
    readonly failing?: boolean;
    readonly travelling?: boolean;
    readonly noPeople?: boolean;
  } = {},
) {
  const drawn: unknown[] = [];
  const cards: MarkerCardContent[] = [];
  const refresh = vi.fn();
  const notify = vi.fn();
  const context = {
    base: '/',
    fetchJson: (url: string) => {
      if (options.failing === true) return Promise.reject(new Error('offline'));
      const people = /people\/(\d+)\.json$/.exec(url)?.[1];
      if (people === undefined) return Promise.resolve(new Response(JSON.stringify(genomes)));
      if (options.noPeople === true) return Promise.reject(new Error('offline'));
      const file = new URL(`../../../public/data/genomes/people/${people}.json`, import.meta.url);
      return Promise.resolve(new Response(readFileSync(file, 'utf8')));
    },
    globe: { addLayer: () => ({ update: (input: unknown) => drawn.push(input) }) },
    notify,
    cards: { show: (card: MarkerCardContent) => cards.push(card) },
    timeline: { travelling: () => options.travelling === true },
    refresh,
  } as unknown as FeatureContext<Capability>;
  return { context, drawn, cards, refresh, notify };
}

describe('the ancient genomes as a feature', () => {
  it('is shown again when the layers or deep time change', () => {
    expect(genomesFeature.watches(on)).toEqual([on.layers, on.ma]);
  });

  it('draws nothing and says nothing while its layer is off, or in deep time', () => {
    const { context, drawn } = fakeContext();
    const shown = genomesFeature.mount(context, context);
    shown.show?.(off, JD);
    shown.show?.({ ...on, ma: 100 }, JD);
    expect(drawn).toEqual([null]);
    expect(shown.said?.()).toBeNull();
  });

  it('stays on the globe while the reader travels through the years, not resting', async () => {
    const { context, drawn, refresh } = fakeContext({ travelling: true });
    const shown = genomesFeature.mount(context, context);
    shown.show?.(bronzeAge, JD);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    shown.show?.(bronzeAge, JD);
    const cells = drawn.at(-1) as readonly unknown[] | null;
    expect(cells?.length).toBeGreaterThan(10);
    expect(shown.said?.()).toMatch(/genomes dated/);
    // The next year, at once, waits for its turn rather than drawing every frame.
    const before = drawn.length;
    shown.show?.({ ...bronzeAge, time: moveToYear(bronzeAge.time, astronomicalYear(-2400)) }, JD);
    expect(drawn).toHaveLength(before);
  });

  it('loads once, then counts the genomes near the year by region, each to tap', async () => {
    const { context, drawn, cards, refresh } = fakeContext();
    const shown = genomesFeature.mount(context, context);
    shown.show?.(bronzeAge, JD);
    expect(shown.said?.()).toBe('Loading the ancient genomes…');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    shown.show?.(bronzeAge, JD);
    const cells = drawn[0] as readonly { cell: number; count: number }[];
    expect(cells.length).toBeGreaterThan(10);
    expect(shown.said?.()).toMatch(/genomes dated/);
    // Another moment of the same year draws nothing new.
    shown.show?.(bronzeAge, JD + 0.5);
    expect(drawn).toHaveLength(1);

    const first = cells[0];
    if (first === undefined) throw new Error('no cell');
    shown.pick?.(String(first.cell));
    // The card waits for the people of the region, then lists them.
    await vi.waitFor(() => {
      expect(cards).toHaveLength(1);
    });
    expect(cards[0]?.facts.map(([label]) => label)).toContain('Genetic sex');
    // Tapped twice at once, only the last opens; again later, from the files kept.
    const second = cells[1];
    if (second === undefined) throw new Error('no second cell');
    shown.pick?.(String(first.cell));
    shown.pick?.(String(second.cell));
    await vi.waitFor(() => {
      expect(cards).toHaveLength(2);
    });
    expect(cards[1]?.title).not.toBe(cards[0]?.title);
    // A region with nothing near the year opens nothing.
    shown.pick?.('99999');
  });

  it('opens a region’s card without its people when they cannot be had', async () => {
    const { context, drawn, cards, refresh } = fakeContext({ noPeople: true });
    const shown = genomesFeature.mount(context, context);
    shown.show?.(bronzeAge, JD);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    shown.show?.(bronzeAge, JD);
    const cells = drawn[0] as readonly { cell: number }[];
    shown.pick?.(String(cells[0]?.cell));
    await vi.waitFor(() => {
      expect(cards).toHaveLength(1);
    });
    expect(cards[0]?.facts.map(([label]) => label)).not.toContain('Genetic sex');
  });

  it('opens no card before the genomes load', () => {
    const { context, cards } = fakeContext();
    genomesFeature.mount(context, context).pick?.('1');
    expect(cards).toEqual([]);
  });

  it('says so when the genomes cannot be loaded, and tries again next time', async () => {
    const { context, notify } = fakeContext({ failing: true });
    const shown = genomesFeature.mount(context, context);
    shown.show?.(bronzeAge, JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the ancient genomes: offline');
    });
    shown.show?.(bronzeAge, JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledTimes(2);
    });
  });
});
