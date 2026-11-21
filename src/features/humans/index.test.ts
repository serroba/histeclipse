import { describe, expect, it, vi } from 'vitest';

import claims from '../../../public/data/humans/claims.json';
import index from '../../../public/data/dispersal/index.json';
import pictures from '../../../public/data/humans/pictures.json';
import admixture from '../../../public/data/humans/admixture.json';
import genomes from '../../../public/data/humans/genomes.json';
import iceAge from '../../../public/data/humans/aadr-ice-age.json';
import routes from '../../../public/data/humans/routes.json';
import species from '../../../public/data/humans/species.json';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import type { DeepChoice, DeepChipView, DeepNoteBlock } from '../../ui/deepChips';
import type { MarkerCardContent } from '../../ui/markerCard';
import type { Capability, FeatureContext } from '../feature';
import { humansFeature } from '.';
import { shadedKa } from './dispersal';

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
  const routed: unknown[] = [];
  let layers = 0;
  const settled: unknown[] = [];
  const cards: MarkerCardContent[] = [];
  const refresh = vi.fn();
  const notify = vi.fn();
  const openTree = vi.fn();
  const change = vi.fn();
  const openAnchor = vi.fn();
  const play = vi.fn();
  const files: Record<string, unknown> = {
    'claims.json': claims,
    'pictures.json': pictures,
    'species.json': species,
    'routes.json': routes,
    'admixture.json': admixture,
    'genomes.json': genomes,
    'aadr-ice-age.json': iceAge,
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
      // The finds' layer first, then the routes'.
      addLayer: () => {
        const into = layers++ === 0 ? drawn : routed;
        return { update: (input: unknown) => into.push(input) };
      },
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
    deepTime: { play },
    refresh,
  } as unknown as FeatureContext<Capability>;
  return {
    context,
    drawn,
    routed,
    settled,
    cards,
    refresh,
    notify,
    openTree,
    change,
    openAnchor,
    play,
  };
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
  // Then the routes, the interbreeding, the finds' DNA and the ice-age DNA, asked for once the
  // finds are in.
  shown.deep?.(on, ICE);
  await vi.waitFor(() => {
    expect(refresh).toHaveBeenCalledTimes(5);
  });
  return shown;
}

describe('the dispersal shading while time plays (#1045)', () => {
  it('shades the moment itself when time stands, and in steps of about a quarter second when it plays', () => {
    expect(shadedKa(0.0604, null)).toBeCloseTo(60.4);
    expect(shadedKa(0.0604, undefined)).toBeCloseTo(60.4);
    // At 10,000 years a second, steps of 3,000 years: about 3 repaints a second.
    expect(shadedKa(0.0604, 0.01)).toBe(60);
    expect(shadedKa(0.0616, 0.01)).toBe(63);
    // At 1,000 years a second, the model's own step.
    expect(shadedKa(0.0604, 0.001)).toBe(60);
    // At 200,000 years a second, steps of 50,000.
    expect(shadedKa(0.08, 0.2)).toBe(100);
  });
});

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
      expect(refresh).toHaveBeenCalledTimes(6);
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
    // Again once its picture loads (its DNA came with the layer, to mark the finds).
    await vi.waitFor(() => {
      expect(cards).toHaveLength(2);
    });
    cards.at(-1)?.action?.run();
    expect(openTree).toHaveBeenCalledTimes(1);
    shown.pick?.('no-such-find');
    expect(cards).toHaveLength(2);
  });

  it('offers our species on the tree of life from its row in the Layers panel', () => {
    const { context, openTree } = fakeContext();
    const action = humansFeature.mount(context, context).action?.();
    expect(action?.label).toBe('Our species on the tree of life');
    action?.run();
    expect(openTree).toHaveBeenCalledTimes(1);
  });

  it('leads from a find to the dispersal models and to ancient DNA where it was found (#731)', async () => {
    const { context, cards, refresh, change, openAnchor } = fakeContext();
    const shown = await loaded(context, refresh);
    const find = claims.claims.find((each) => 'species' in each && each.place !== null);
    if (find === undefined) throw new Error('no placed find');
    shown.pick?.(find.id);
    const related = cards[0]?.related ?? [];
    expect(related.map((step) => step.label)).toEqual([
      expect.stringMatching(/^About /),
      'People spreading out of Africa',
      'Ancient DNA near here',
    ]);
    related[1]?.run();
    const update = change.mock.calls[0]?.[0] as (state: ViewState) => ViewState;
    expect(update(on).dispersal).toBe('a');
    related[2]?.run();
    expect(openAnchor).toHaveBeenCalledWith(
      expect.objectContaining({ view: expect.stringContaining('explore=ancient-dna') as unknown }),
    );
    // With a model drawn, the dispersal is not offered again.
    shown.deep?.({ ...on, dispersal: 'b' }, ICE);
    shown.pick?.(find.id);
    expect(cards.at(-1)?.related?.map((step) => step.label)).toEqual([
      expect.stringMatching(/^About /),
      'Ancient DNA near here',
    ]);
    // A claim with no one place leads nowhere near.
    const unplaced = claims.claims.find((each) => each.place === null);
    if (unplaced === undefined) throw new Error('no unplaced claim');
    const before = cards.length;
    shown.pick?.(unplaced.id);
    expect(
      cards
        .slice(before)
        .flatMap((card) => card.related ?? [])
        .map((s) => s.label),
    ).toEqual([expect.stringMatching(/^About /)]);
  });

  it('lists the species marked, each opening its own card, as a find’s card does (#1034)', async () => {
    const { context, cards, refresh, openTree } = fakeContext();
    const shown = await loaded(context, refresh);
    const blocks = shown.deep?.(on, ICE)?.note ?? [];
    const legend = blocks.flatMap((block) =>
      typeof block === 'object' && 'list' in block
        ? block.list.filter((item) => item.class.startsWith('humans-legend'))
        : [],
    );
    expect(legend.map((item) => item.class)).toContain('humans-legend is-sapiens');
    const name = legend.find((item) => item.class.endsWith('is-sapiens'))?.parts[0];
    if (typeof name !== 'object' || !('run' in name)) throw new Error('no button');
    expect(name.text).toBe('Homo sapiens');
    name.run();
    await vi.waitFor(() => {
      expect(cards.at(-1)?.title).toBe('Modern humans (Homo sapiens)');
    });
    cards.at(-1)?.action?.run();
    expect(openTree).toHaveBeenCalledTimes(1);
    // From a find, the step to its species opens the same card.
    shown.pick?.('jebel-irhoud');
    cards.at(-1)?.related?.[0]?.run();
    expect(cards.at(-1)?.title).toBe('Modern humans (Homo sapiens)');
    // An unknown species opens nothing.
    const before = cards.length;
    shown.pick?.('species-martian');
    expect(cards).toHaveLength(before);
  });

  it('draws the routes argued for, each opening its card, and lists them in the note (#177)', async () => {
    const { context, cards, refresh, routed } = fakeContext();
    const shown = await loaded(context, refresh);
    const chip = shown.deep?.(on, ICE);
    const drawnRoutes = routed.at(-1) as readonly { id: string }[];
    expect(drawnRoutes.map((route) => route.id)).toContain('southern-route');
    const listed = (chip?.note ?? []).flatMap((block) =>
      typeof block === 'object' && 'list' in block
        ? block.list.filter((item) => item.class.startsWith('humans-route'))
        : [],
    );
    const southern = listed.find((item) =>
      (() => {
        const last = item.parts.at(-1);
        return typeof last === 'string' && last.startsWith(' Macaulay et al. 2005, Science; ');
      })(),
    );
    const button = southern?.parts[0];
    if (typeof button !== 'object' || !('run' in button)) throw new Error('no button');
    expect(southern?.parts.at(-1)).toMatch(/; \d+ studies for, \d+ against$/);
    button.run();
    expect(cards.at(-1)?.title).toBe('Southern route');
    shown.pick?.('route-ice-free-corridor');
    expect(cards.at(-1)?.title).toBe('Ice-free corridor');
    const before = cards.length;
    shown.pick?.('route-nowhere');
    expect(cards).toHaveLength(before);
    // Off the layer, the routes go too.
    shown.deep?.({ ...on, layers: base.layers }, ICE);
    expect(routed.at(-1)).toBeNull();
  });

  it('says so when the routes cannot be loaded', async () => {
    const { context, refresh, notify } = fakeContext({ missing: 'routes.json' });
    const shown = humansFeature.mount(context, context);
    shown.deep?.(on, ICE);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    shown.deep?.(on, ICE);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the routes: offline');
    });
  });

  it('leads a species the tree lacks to the genus Homo, or nowhere if the tree lacks that too', async () => {
    const { context, cards, refresh, openTree } = fakeContext();
    const shown = await loaded(context, refresh);
    const erectus = claims.claims.find((each) => each.species === 'erectus');
    if (erectus === undefined) throw new Error('no H. erectus find');
    shown.pick?.(erectus.id);
    cards.at(-1)?.action?.run();
    const pick = openTree.mock.calls.at(-1)?.[0] as (tree: unknown) => number | undefined;
    const tree = (names: string[]) => ({ name: names, ours: { humans: { sapiens: 9 } } });
    expect(pick(tree(['Life', 'Homo']))).toBe(1);
    expect(pick(tree(['Life']))).toBeUndefined();
  });

  it('plays the human story: Humans and a model on, facing Africa, from 315,000 years ago (#177)', async () => {
    const { context, refresh, change, play } = fakeContext();
    const shown = await loaded(context, refresh);
    const first = shown.deep?.(on, ICE)?.note?.[0];
    if (typeof first !== 'object' || !('paragraph' in first)) throw new Error('no story');
    const button = first.paragraph[0];
    if (typeof button !== 'object' || !('run' in button)) throw new Error('no button');
    expect(button.text).toBe('▶ Play the human story');
    button.run();
    expect(play).toHaveBeenCalledWith(0.315, 'ice', 0.01);
    const update = change.mock.calls.at(-1)?.[0] as (state: ViewState) => ViewState;
    const after = update({ ...on, layers: base.layers });
    expect(after.layers.has('humans')).toBe(true);
    expect(after.dispersal).toBe('a');
    expect(after.camera.target).toEqual({ latitude: 12, longitude: 40 });
    // A model already picked is kept.
    expect(update({ ...on, dispersal: 'b' }).dispersal).toBe('b');
  });

  it('plays the human story once when a link asks for it, and the ask leaves the address', async () => {
    const { context, change, play } = fakeContext();
    const shown = humansFeature.mount(context, context);
    shown.deep?.({ ...on, story: 'humans' }, ICE);
    shown.deep?.({ ...on, story: 'humans' }, ICE);
    await vi.waitFor(() => {
      expect(play).toHaveBeenCalledTimes(1);
    });
    const update = change.mock.calls.at(-1)?.[0] as (state: ViewState) => ViewState;
    expect(update({ ...on, story: 'humans' }).story).toBe('off');
    // Asked from the years too, where nothing of deep time is shown yet.
    shown.deep?.({ ...base, story: 'humans' }, null);
    await vi.waitFor(() => {
      expect(play).toHaveBeenCalledTimes(2);
    });
  });

  it('shows only one species when asked from the legend, and all again (#1047)', async () => {
    const { context, refresh, change, drawn } = fakeContext();
    const shown = await loaded(context, refresh);
    const items = (view: ReturnType<NonNullable<typeof shown.deep>> | undefined) =>
      (view?.note ?? []).flatMap((block) =>
        typeof block === 'object' && 'list' in block
          ? block.list.filter((item) => item.class.startsWith('humans-legend'))
          : [],
      );
    const at = { ...on, ma: 0.045 };
    const moment = { ma: 0.045, scale: 'ice' } as const;
    const sapiens = items(shown.deep?.(at, moment)).find((item) =>
      item.class.endsWith('is-sapiens'),
    );
    const onlyThese = sapiens?.parts[2];
    if (typeof onlyThese !== 'object' || !('run' in onlyThese)) throw new Error('no toggle');
    expect(onlyThese.text).toBe('Only these');
    onlyThese.run();
    const update = change.mock.calls.at(-1)?.[0] as (state: ViewState) => ViewState;
    const filtered = update(at);
    expect(filtered.humanSpecies).toBe('sapiens');
    // Only that species is marked, and the note says so, with a way back.
    const view = shown.deep?.(filtered, moment);
    const sites = drawn.at(-1) as readonly { species: string }[];
    expect(sites.length).toBeGreaterThan(0);
    expect(sites.every((site) => site.species === 'sapiens')).toBe(true);
    expect(words(view)).toMatch(/Showing only Homo sapiens\. Show all species/);
    const back = items(view).find((item) => item.class.includes('is-only'))?.parts[2];
    if (typeof back !== 'object' || !('run' in back)) throw new Error('no way back');
    expect(back.text).toBe('Show all');
    back.run();
    const again = change.mock.calls.at(-1)?.[0] as (state: ViewState) => ViewState;
    expect(again(filtered).humanSpecies).toBe('all');
  });

  it('lists interbreeding in the note, each episode and trait to its card, and on to its finds (#1047)', async () => {
    const { context, cards, refresh } = fakeContext();
    const shown = await loaded(context, refresh);
    const view = shown.deep?.({ ...on, ma: 0.03 }, { ma: 0.03, scale: 'ice' });
    expect(words(view)).toMatch(/Interbreeding, as DNA shows it/);
    const episodes = (view?.note ?? []).flatMap((block) =>
      typeof block === 'object' && 'list' in block
        ? block.list.filter((item) => item.class === 'humans-mixing')
        : [],
    );
    const oase = episodes.find((item) => {
      const first = item.parts[0];
      return typeof first === 'object' && 'text' in first && first.text.includes('first Europeans');
    })?.parts[0];
    if (typeof oase !== 'object' || !('run' in oase)) throw new Error('no episode');
    oase.run();
    const card = cards.at(-1);
    expect(card?.facts[0]).toEqual(['Who', 'From Neanderthals into Homo sapiens']);
    const toOase = card?.related?.find((step) => step.label.includes('Oase'));
    toOase?.run();
    expect(cards.at(-1)?.title).toMatch(/Oase/);
    // A trait, from the line on what living people carry.
    shown.pick?.('trait-covid-19');
    expect(cards.at(-1)?.title).toMatch(/COVID-19/);
    const before = cards.length;
    shown.pick?.('mix-nowhere');
    expect(cards).toHaveLength(before);
  });

  it('says so when the interbreeding cannot be loaded', async () => {
    const { context, refresh, notify } = fakeContext({ missing: 'admixture.json' });
    const shown = humansFeature.mount(context, context);
    shown.deep?.(on, ICE);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    shown.deep?.(on, ICE);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the interbreeding: offline');
    });
  });

  it('gives a site’s card its ancient DNA once it loads (#1047)', async () => {
    const { context, cards, refresh } = fakeContext({ cardOpen: true });
    const shown = await loaded(context, refresh);
    shown.pick?.('vindija');
    await vi.waitFor(() => {
      expect(cards.at(-1)?.facts.some(([label]) => label === 'Ancient DNA')).toBe(true);
    });
  });

  it('marks the ice-age DNA of our species from each place’s oldest date, each to its card (#1059)', async () => {
    const { context, cards, refresh, change, drawn } = fakeContext();
    const shown = await loaded(context, refresh);
    const at = (ka: number) => ({ ...on, ma: ka / 1000 });
    const moment = (ka: number) => ({ ma: ka / 1000, scale: 'ice' }) as const;
    const dnaSites = () =>
      (drawn.at(-1) as readonly { id: string; dna?: boolean; label: string }[]).filter(
        (site) => site.dna === true,
      );
    // 60,000 years ago, none yet; by 30,000, Sunghir and others, after the finds.
    shown.deep?.(at(60), moment(60));
    expect(dnaSites()).toEqual([]);
    const view = shown.deep?.(at(30), moment(30));
    const sunghir = dnaSites().find((site) => site.id === 'dna-sunghir-russia');
    expect(sunghir?.label).toBe('Sunghir DNA 33.2–34.6 ka');
    expect(words(view)).toMatch(
      /Ancient DNA: \d+ finds with DNA read \(marked DNA\); \d+ people of our species at \d+ places/,
    );
    shown.pick?.('dna-sunghir-russia');
    const card = cards.at(-1);
    expect(card?.title).toBe('Ancient DNA: Sunghir, Russia');
    expect(card?.facts).toContainEqual(['Genomes', '4 people']);
    expect(card?.facts.some(([label]) => label === 'Sunghir1')).toBe(true);
    // None while only another species is shown; still there for ours.
    shown.deep?.({ ...at(30), humanSpecies: 'neanderthal' }, moment(30));
    expect(dnaSites()).toEqual([]);
    shown.deep?.({ ...at(30), humanSpecies: 'sapiens' }, moment(30));
    expect(dnaSites().length).toBeGreaterThan(5);
    expect(change).not.toHaveBeenCalled();
    const before = cards.length;
    shown.pick?.('dna-nowhere');
    expect(cards).toHaveLength(before);
  });

  it('marks the finds with DNA, and shows only those and the DNA places when asked (#1059)', async () => {
    const { context, refresh, change, drawn } = fakeContext();
    const shown = await loaded(context, refresh);
    const at = { ...on, ma: 0.03 };
    const moment = { ma: 0.03, scale: 'ice' } as const;
    const view = shown.deep?.(at, moment);
    interface Site {
      id: string;
      hasDna?: boolean;
      dna?: boolean;
    }
    const sites = () => drawn.at(-1) as readonly Site[];
    expect(sites().find((site) => site.id === 'vindija')?.hasDna).toBe(true);
    expect(sites().some((site) => site.hasDna !== true && site.dna !== true)).toBe(true);
    const row = (view?.note ?? [])
      .flatMap((block) => (typeof block === 'object' && 'list' in block ? block.list : []))
      .find((item) => item.class.startsWith('humans-legend is-dna'));
    const onlyThese = row?.parts[1];
    if (typeof onlyThese !== 'object' || !('run' in onlyThese)) throw new Error('no toggle');
    expect(onlyThese.text).toBe('Only these');
    onlyThese.run();
    const update = change.mock.calls.at(-1)?.[0] as (state: ViewState) => ViewState;
    const filtered = update(at);
    expect(filtered.humanSpecies).toBe('dna');
    const only = shown.deep?.(filtered, moment);
    expect(sites().length).toBeGreaterThan(10);
    expect(sites().every((site) => site.hasDna === true || site.dna === true)).toBe(true);
    expect(words(only)).toMatch(/Showing only the finds and places with ancient DNA\./);
    const back = (only?.note ?? [])
      .flatMap((block) => (typeof block === 'object' && 'list' in block ? block.list : []))
      .find((item) => item.class === 'humans-legend is-dna is-only')?.parts[1];
    if (typeof back !== 'object' || !('run' in back)) throw new Error('no way back');
    expect(back.text).toBe('Show all');
    back.run();
    const again = change.mock.calls.at(-1)?.[0] as (state: ViewState) => ViewState;
    expect(again(filtered).humanSpecies).toBe('all');
  });

  it('says so when the species cannot be loaded', async () => {
    const { context, refresh, notify } = fakeContext({ missing: 'species.json' });
    const shown = await loaded(context, refresh);
    shown.pick?.('species-erectus');
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the human species: offline');
    });
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
