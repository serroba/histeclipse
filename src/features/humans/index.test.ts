import { describe, expect, it, vi } from 'vitest';

import claims from '../../../public/data/humans/claims.json';
import index from '../../../public/data/dispersal/index.json';
import pictures from '../../../public/data/humans/pictures.json';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import type { DeepChoice, DeepChipView, DeepNoteBlock } from '../../ui/deepChips';
import type { MarkerCardContent } from '../../ui/markerCard';
import type { Capability, FeatureContext } from '../feature';
import { humansFeature } from '.';

// The arrival grids are images read through a canvas: a small grid stands in for them here.
vi.mock('./arrivalGrid', () => ({
  loadArrivalGrid: () =>
    Promise.resolve({ columns: 2, rows: 1, arrival: new Uint8Array([100, 50]) }),
}));

const base = defaultViewState(new Date('2026-01-01T00:00:00Z'));
/** The ice-age span, with Humans on, 60,000 years ago. */
const on: ViewState = {
  ...base,
  ma: 0.06,
  deepScale: 'ice',
  layers: withLayer(base.layers, 'humans', true),
};
const ICE = { ma: 0.06, scale: 'ice' } as const;

/** A context that records what the feature asks of the app (#380): no globe, no page. */
function fakeContext(
  options: {
    readonly failing?: boolean;
    readonly missing?: string;
    readonly files?: Record<string, unknown>;
    readonly cardOpen?: boolean;
  } = {},
) {
  const drawn: unknown[] = [];
  const settled: unknown[] = [];
  const cards: MarkerCardContent[] = [];
  const refresh = vi.fn();
  const notify = vi.fn();
  const openTree = vi.fn();
  const change = vi.fn();
  const openAnchor = vi.fn();
  const files: Record<string, unknown> = {
    'claims.json': claims,
    'pictures.json': pictures,
    'index.json': index,
    ...options.files,
  };
  const context = {
    base: '/',
    fetchJson: (url: string) =>
      options.failing === true || (options.missing !== undefined && url.endsWith(options.missing))
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(new Response(JSON.stringify(files[url.split('/').at(-1) ?? '']))),
    globe: {
      addLayer: () => ({ update: (input: unknown) => drawn.push(input) }),
    },
    notify,
    cards: {
      show: (card: MarkerCardContent) => cards.push(card),
      open: () => options.cardOpen ?? true,
    },
    tree: { openTree },
    settledLand: { setSettled: (input: unknown) => settled.push(input) },
    change,
    anchors: { open: openAnchor },
    refresh,
  } as unknown as FeatureContext<Capability>;
  return { context, drawn, settled, cards, refresh, notify, openTree, change, openAnchor };
}

/** The note's words, picker and lists aside. */
function words(chip: DeepChipView | null | undefined): string {
  const text = (block: DeepNoteBlock): string => {
    if (typeof block === 'string') return block;
    if ('paragraph' in block) return block.paragraph.map(text).join('');
    if ('list' in block) return block.list.map((item) => item.parts.map(text).join('')).join('\n');
    return 'text' in block ? block.text : '';
  };
  return (chip?.note ?? []).map(text).join('\n');
}

function choice(chip: DeepChipView | null | undefined): DeepChoice | undefined {
  for (const block of chip?.note ?? []) {
    if (typeof block === 'string' || !('paragraph' in block)) continue;
    for (const part of block.paragraph)
      if (typeof part !== 'string' && 'choose' in part) return part.choose;
  }
  return undefined;
}

async function loaded(context: FeatureContext<Capability>, refresh: ReturnType<typeof vi.fn>) {
  const shown = humansFeature.mount(context, context);
  shown.deep?.(on, ICE);
  await vi.waitFor(() => {
    expect(refresh).toHaveBeenCalled();
  });
  return shown;
}

describe('the humans as a feature', () => {
  it('has its chip in the deep-time bar', () => {
    expect(humansFeature.deepChip).toEqual({ label: 'Humans', why: 'humans' });
  });

  it('offers its chip on the ice-age span only, off until turned on', () => {
    const { context, drawn, settled } = fakeContext();
    const shown = humansFeature.mount(context, context);
    const off = { ...on, layers: base.layers };
    expect(shown.deep?.(off, ICE)).toEqual({ offered: true, on: false, note: null });
    expect(shown.deep?.(off, { ma: 150, scale: 'all' })).toEqual({
      offered: false,
      on: false,
      note: null,
    });
    expect(shown.deep?.(on, null)).toBeNull();
    expect(drawn).toEqual([null, null, null]);
    expect(settled).toEqual([null, null, null]);
  });

  it('says it is loading, then marks the finds and gives the competing claims', async () => {
    const { context, drawn, refresh } = fakeContext();
    const shown = humansFeature.mount(context, context);
    expect(shown.deep?.(on, ICE)?.note).toEqual([{ paragraph: ['Humans: loading…'] }]);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    const chip = shown.deep?.(on, ICE);
    expect(chip?.on).toBe(true);
    expect(words(chip)).toMatch(/dated finds marked/);
    expect(words(chip)).toMatch(/When did people first reach Australia\?/);
    expect(words(chip)).toMatch(/Clarkson et al\. 2017/);
    const sites = drawn.at(-1) as readonly { label: string }[];
    expect(sites.some((site) => site.label.includes('Madjedbebe'))).toBe(true);
  });

  it('picks a dispersal model through the view, and shades it once it loads', async () => {
    const { context, settled, refresh, change } = fakeContext();
    const shown = await loaded(context, refresh);
    const picker = choice(shown.deep?.(on, ICE));
    expect(picker?.name).toBe('Dispersal model');
    expect(picker?.value).toBe('off');
    picker?.pick('a');
    picker?.pick('nonsense');
    expect(change).toHaveBeenCalledTimes(1);
    const update = change.mock.calls[0]?.[0] as (state: ViewState) => ViewState;
    const withModel = update(on);
    expect(withModel.dispersal).toBe('a');
    expect(words(shown.deep?.(withModel, ICE))).toMatch(/Loading the model…/);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(2);
    });
    expect(words(shown.deep?.(withModel, ICE))).toMatch(
      /model, early exit from Africa \(scenario A\), has people settled by then: 50% of the land/,
    );
    expect(settled.at(-1)).toMatchObject({ scenario: 'a', ka: 60 });
  });

  it('opens a find’s card, again with its picture, and leads to its species on the tree', async () => {
    const { context, cards, refresh, openTree } = fakeContext();
    const shown = await loaded(context, refresh);
    const id = claims.claims.find((each) => 'species' in each)?.id;
    if (id === undefined) throw new Error('no find with a species');
    shown.pick?.(id);
    expect(cards).toHaveLength(1);
    await vi.waitFor(() => {
      expect(cards).toHaveLength(2);
    });
    cards[1]?.action?.run();
    expect(openTree).toHaveBeenCalledTimes(1);
    shown.pick?.('no-such-find');
    expect(cards).toHaveLength(2);
  });

  it('leads from a find to the dispersal models and to ancient DNA where it was found (#731)', async () => {
    const { context, cards, refresh, change, openAnchor } = fakeContext();
    const shown = await loaded(context, refresh);
    const find = claims.claims.find((each) => 'species' in each && each.place !== null);
    if (find === undefined) throw new Error('no placed find');
    shown.pick?.(find.id);
    const related = cards[0]?.related ?? [];
    expect(related.map((step) => step.label)).toEqual([
      'People spreading out of Africa',
      'Ancient DNA near here',
    ]);
    related[0]?.run();
    const update = change.mock.calls[0]?.[0] as (state: ViewState) => ViewState;
    expect(update(on).dispersal).toBe('a');
    related[1]?.run();
    expect(openAnchor).toHaveBeenCalledWith(
      expect.objectContaining({ view: expect.stringContaining('explore=ancient-dna') as unknown }),
    );
    // With a model drawn, the dispersal is not offered again.
    shown.deep?.({ ...on, dispersal: 'b' }, ICE);
    shown.pick?.(find.id);
    expect(cards.at(-1)?.related?.map((step) => step.label)).toEqual(['Ancient DNA near here']);
    // A claim with no one place leads nowhere near.
    const unplaced = claims.claims.find((each) => each.place === null);
    if (unplaced === undefined) throw new Error('no unplaced claim');
    const before = cards.length;
    shown.pick?.(unplaced.id);
    expect(cards.slice(before).flatMap((card) => card.related ?? [])).toEqual([]);
  });

  it('says so when the pictures cannot be loaded, and opens no card for a find let go', async () => {
    const { context, cards, refresh, notify } = fakeContext({ missing: 'pictures.json' });
    const shown = await loaded(context, refresh);
    const id = claims.claims[0]?.id;
    if (id === undefined) throw new Error('no find');
    shown.pick?.(id);
    shown.unpick?.();
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the finds’ pictures: offline');
    });
    expect(cards).toHaveLength(1);
  });

  it('says so when the dispersal model cannot be loaded', async () => {
    const { context, refresh, notify } = fakeContext({ missing: 'index.json' });
    const shown = await loaded(context, refresh);
    shown.deep?.({ ...on, dispersal: 'b' }, ICE);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the dispersal model: offline');
    });
    expect(humansFeature.watches(on)).toEqual([]);
  });

  it('loads once though asked again while loading, and opens no card before', async () => {
    const { context, cards, refresh } = fakeContext();
    const shown = humansFeature.mount(context, context);
    shown.deep?.({ ...on, dispersal: 'a' }, ICE);
    shown.deep?.({ ...on, dispersal: 'a' }, ICE);
    shown.pick?.(claims.claims[0]?.id ?? '');
    expect(cards).toHaveLength(0);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(2);
    });
  });

  it('lists the claims with no question, at a moment that has them', async () => {
    const { context, refresh } = fakeContext();
    const shown = await loaded(context, refresh);
    const moments = [0.001, 0.01, 0.03, 0.045, 0.06, 0.1, 0.2, 0.3, 0.5];
    const lists = moments.map(
      (ma) =>
        (shown.deep?.({ ...on, ma }, { ma, scale: 'ice' })?.note ?? []).filter(
          (block) => typeof block !== 'string' && 'list' in block,
        ).length,
    );
    expect(Math.max(...lists)).toBeGreaterThan(0);
  });

  it('opens no card for a find let go when its picture comes, and the next card has it', async () => {
    const { context, cards, refresh } = fakeContext();
    const shown = await loaded(context, refresh);
    const id = claims.claims[0]?.id ?? '';
    shown.pick?.(id);
    shown.unpick?.();
    // The pictures are in: the next card has them at once.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(cards).toHaveLength(1);
    shown.pick?.(id);
    expect(cards).toHaveLength(2);
  });

  it('opens no card again when the reader closed it before the picture came', async () => {
    const { context, cards, refresh } = fakeContext({ cardOpen: false });
    const shown = await loaded(context, refresh);
    shown.pick?.(claims.claims[0]?.id ?? '');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(cards).toHaveLength(1);
  });

  it('says so when the model has no such scenario', async () => {
    const { context, refresh, notify } = fakeContext({
      files: { 'index.json': { ...index, scenarios: [] } },
    });
    const shown = await loaded(context, refresh);
    shown.deep?.({ ...on, dispersal: 'a' }, ICE);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the dispersal model: no scenario a');
    });
  });

  it('says so when the finds cannot be loaded', async () => {
    const { context, notify } = fakeContext({ failing: true });
    humansFeature.mount(context, context).deep?.(on, ICE);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the human finds: offline');
    });
  });
});
