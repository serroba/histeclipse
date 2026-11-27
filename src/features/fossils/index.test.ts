import { describe, expect, it, vi } from 'vitest';

import pictures from '../../../public/data/fossil-pictures.json';
import fossils from '../../../public/data/fossils.json';
import dinosaurs from '../../../public/data/time-tree/dinosaurs.json';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import type { MarkerCardContent } from '../../ui/markerCard';
import type { Capability, FeatureContext } from '../feature';
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
  // The second layer: one genus's finds, ringed (#309).
  const ringed: unknown[] = [];
  let layers = 0;
  const cards: MarkerCardContent[] = [];
  const refresh = vi.fn();
  const notify = vi.fn();
  const openLineages = vi.fn();
  const change = vi.fn();
  const context = {
    base: '/',
    fetchJson: (url: string) =>
      options.failing === true
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(
            new Response(
              JSON.stringify(
                url.endsWith('pictures.json')
                  ? pictures
                  : url.includes('time-tree')
                    ? dinosaurs
                    : fossils,
              ),
            ),
          ),
    globe: {
      addLayer: () => {
        const into = layers++ === 0 ? drawn : ringed;
        return { update: (input: unknown) => into.push(input) };
      },
    },
    notify,
    cards: { show: (card: MarkerCardContent) => cards.push(card), open: () => true },
    tree: { openLineages },
    change,
    refresh,
  } as unknown as FeatureContext<Capability>;
  return { context, drawn, ringed, cards, refresh, notify, openLineages, change };
}

describe('the fossils as a feature', () => {
  it('has its chip in the deep-time bar', () => {
    expect(fossilsFeature.deepChip).toEqual({ label: 'Fossils', why: 'fossils' });
  });

  it('offers its chip on the 540 Myr span only, off until turned on', () => {
    const { context, drawn } = fakeContext();
    const shown = fossilsFeature.mount(context, context);
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

  it('Given the fossils do not load, Then its chip says so, deep time playing does not fetch them again, and Try again does (#762)', async () => {
    const { context, notify } = fakeContext({ failing: true });
    const shown = fossilsFeature.mount(context, context);
    expect(shown.load?.()).toBeNull();
    shown.deep?.(on, JURASSIC);
    expect(shown.load?.()).toEqual({ state: 'loading' });
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the fossils: offline');
    });
    expect(shown.deep?.(on, { ma: 149, scale: 'all' })?.note).toEqual(['Fossils: could not load.']);
    expect(notify).toHaveBeenCalledOnce();
    const failed = shown.load?.();
    if (failed?.state !== 'failed') throw new Error('expected a failed load');
    failed.retry();
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledTimes(2);
    });
    shown.deep?.(on, null);
    expect(shown.load?.()).toBeNull();
  });

  it('says it is loading, then marks the finds of the moment, with a key and the source', async () => {
    const { context, drawn, refresh } = fakeContext();
    const shown = fossilsFeature.mount(context, context);
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
    const { context, drawn, cards, refresh, openLineages, change } = fakeContext();
    const shown = fossilsFeature.mount(context, context);
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
    // Related (#731): the climate then, at the same moment.
    expect(cards[1]?.related?.map((step) => step.label)).toEqual(['The climate then']);
    cards[1]?.related?.[0]?.run();
    const update = change.mock.calls[0]?.[0] as (state: typeof on) => typeof on;
    expect(update(on).layers.has('temperature')).toBe(true);
    expect(update(on).ma).toBe(on.ma);
    shown.pick?.('no:such:cell');
    expect(cards).toHaveLength(2);
  });

  it('offers the dinosaurs’ lines through time from its row in the Layers panel', () => {
    const { context, change } = fakeContext();
    const action = fossilsFeature.mount(context, context).action?.();
    expect(action?.label).toBe('Their tree through time');
    action?.run();
    const update = change.mock.calls[0]?.[0] as (state: ViewState) => ViewState;
    expect(update(on).lineages).toEqual({ group: 'dinosaurs', pick: null });
  });

  it('rings a genus’s finds where the link names one, and says where its nearest are (#309)', async () => {
    const { context, ringed, refresh, change } = fakeContext();
    const shown = fossilsFeature.mount(context, context);
    const rex: ViewState = { ...on, ma: 68, finds: { group: 'dinosaurs', pbdb: 38613 } };
    const text = (): string =>
      (shown.deep?.(rex, { ma: rex.ma ?? 0, scale: 'all' })?.note ?? [])
        .map((part) => (typeof part === 'string' ? part : 'text' in part ? part.text : ''))
        .join('');
    text();
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    expect(text()).toContain('Its finds: loading…');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(2);
    });
    // Near 70 Ma: its North American sites.
    expect(text()).toMatch(/Tyrannosaurus, ringed: found at \d+ sites within 2\.5 million years/);
    const sites = ringed.at(-1) as { group: string; sites: readonly unknown[] };
    expect(sites.group).toBe('dinosaurs');
    expect(sites.sites.length).toBeGreaterThan(1);
    // Long before it: none, a way to its nearest, and a way to stop.
    const early = { ...rex, ma: 150 };
    const note = shown.deep?.(early, { ma: 150, scale: 'all' })?.note ?? [];
    const runs = note.flatMap((part) => (typeof part === 'object' && 'run' in part ? [part] : []));
    expect(runs.map((part) => part.text)).toEqual([
      'Go to its nearest finds, 80 million years ago',
      'Stop marking Tyrannosaurus',
    ]);
    expect(ringed.at(-1)).toEqual({ group: 'dinosaurs', sites: [] });
    runs.at(-2)?.run();
    runs.at(-1)?.run();
    const [go, stop] = change.mock.calls.map((call) => call[0] as (state: ViewState) => ViewState);
    expect(go?.(early).ma).toBe(80);
    expect(stop?.(early).finds).toBeNull();
  });

  it('says so when the genus to mark is not in its group’s lines', async () => {
    const { context, refresh } = fakeContext();
    const shown = fossilsFeature.mount(context, context);
    const lost: ViewState = { ...on, finds: { group: 'dinosaurs', pbdb: 1 } };
    shown.deep?.(lost, JURASSIC);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    // The fossils first, then the genus's group.
    shown.deep?.(lost, JURASSIC);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(2);
    });
    const note = shown.deep?.(lost, JURASSIC)?.note ?? [];
    expect(note).toContain(' The genus to mark is not among the lines through time.');
    expect(note.some((part) => typeof part === 'object' && 'run' in part)).toBe(true);
  });

  it('says so when the fossils cannot be loaded', async () => {
    const { context, notify } = fakeContext({ failing: true });
    fossilsFeature.mount(context, context).deep?.(on, JURASSIC);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the fossils: offline');
    });
  });
});
