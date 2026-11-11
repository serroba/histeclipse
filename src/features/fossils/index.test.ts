import { describe, expect, it, vi } from 'vitest';

import pictures from '../../../public/data/fossil-pictures.json';
import fossils from '../../../public/data/fossils.json';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import type { MarkerCardContent } from '../../ui/markerCard';
import type { FeatureContext } from '../feature';
import { fossilsFeature } from '.';

const base = defaultViewState(new Date('2026-01-01T00:00:00Z'));
/** The 540 Myr span, with Fossils on, in the Jurassic. */
const on: ViewState = {
  ...base,
  ma: 150,
  deepScale: 'all',
  layers: withLayer(base.layers, 'fossils', true),
};
const JURASSIC = { ma: 150, scale: 'all' } as const;

/** A context that records what the feature asks of the app (#380): no globe, no page. */
function fakeContext(options: { readonly failing?: boolean } = {}) {
  const drawn: unknown[] = [];
  const cards: MarkerCardContent[] = [];
  const refresh = vi.fn();
  const notify = vi.fn();
  const openLineages = vi.fn();
  const context = {
    base: '/',
    fetchJson: (url: string) =>
      options.failing === true
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(
            new Response(JSON.stringify(url.endsWith('pictures.json') ? pictures : fossils)),
          ),
    globe: { addLayer: () => ({ update: (input: unknown) => drawn.push(input) }) },
    notify,
    showCard: (card: MarkerCardContent) => cards.push(card),
    cardOpen: () => true,
    openLineages,
    refresh,
  } as unknown as FeatureContext;
  return { context, drawn, cards, refresh, notify, openLineages };
}

describe('the fossils as a feature', () => {
  it('has its chip in the deep-time bar', () => {
    expect(fossilsFeature.deepChip).toEqual({ label: 'Fossils', icon: 'fossils', why: 'fossils' });
  });

  it('offers its chip on the 540 Myr span only, off until turned on', () => {
    const { context, drawn } = fakeContext();
    const shown = fossilsFeature.mount(context);
    const off = { ...on, layers: base.layers };
    expect(shown.deep?.(off, JURASSIC)).toEqual({ offered: true, on: false, note: null });
    expect(shown.deep?.(off, { ma: 0.02, scale: 'ice' })).toEqual({
      offered: false,
      on: false,
      note: null,
    });
    expect(shown.deep?.(on, null)).toBeNull();
    expect(drawn).toEqual([null, null, null]);
  });

  it('says it is loading, then marks the finds of the moment, with a key and the source', async () => {
    const { context, drawn, refresh } = fakeContext();
    const shown = fossilsFeature.mount(context);
    expect(shown.deep?.(on, JURASSIC)?.note).toEqual(['Fossils: loading…']);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    const chip = shown.deep?.(on, JURASSIC);
    expect(chip?.on).toBe(true);
    const text = (chip?.note ?? [])
      .map((part) => (typeof part === 'string' ? part : 'text' in part ? part.text : ''))
      .join('');
    expect(text).toMatch(/million years ago/);
    expect(text).toMatch(/Paleobiology Database/);
    const cells = drawn[0] as readonly { group: string; latitude: number; longitude: number }[];
    expect(cells.length).toBeGreaterThan(0);
  });

  it('opens a cell’s card, again with its pictures, and leads to the tree of life', async () => {
    const { context, drawn, cards, refresh, openLineages } = fakeContext();
    const shown = fossilsFeature.mount(context);
    shown.deep?.(on, JURASSIC);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    shown.deep?.(on, JURASSIC);
    const cell = (drawn[0] as readonly { group: string; latitude: number; longitude: number }[])[0];
    if (cell === undefined) throw new Error('no cell');
    shown.pick?.(`${cell.group}:${String(cell.latitude)}:${String(cell.longitude)}`);
    expect(cards).toHaveLength(1);
    await vi.waitFor(() => {
      expect(cards).toHaveLength(2);
    });
    cards[1]?.action?.run();
    expect(openLineages).toHaveBeenCalledWith(cell.group, expect.any(String));
    shown.pick?.('no:such:cell');
    expect(cards).toHaveLength(2);
  });

  it('says so when the fossils cannot be loaded', async () => {
    const { context, notify } = fakeContext({ failing: true });
    fossilsFeature.mount(context).deep?.(on, JURASSIC);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the fossils: offline');
    });
  });
});
