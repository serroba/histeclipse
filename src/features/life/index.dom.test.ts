// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseLife, type LifeData } from '../../data/lifeStories';
import { createStore } from '../../state/store';
import { defaultViewState, type LifeStory, type ViewState } from '../../state/viewState';
import { marksAt } from './marks';
import type { LifeMarks } from './marksLayer';
import { storyOf } from './story';
import { mountLife, type LifeContext } from '.';

const FOLDER = join(import.meta.dirname, '../../../public/data/life-stories');
const text = (name: string): string => readFileSync(join(FOLDER, `${name}.json`), 'utf8');
type Served = Readonly<Record<string, string | Error>>;
const REAL: Served = {
  'mammals.json': text('mammals'),
  'dinosaurs.json': text('dinosaurs'),
  'pictures.json': text('pictures'),
  'doors.json': text('doors'),
};
const mammals = parseLife(JSON.parse(text('mammals')));

const pbdbOf = (data: LifeData, name: string): number =>
  data.nodes.find((node) => node.name === name)?.pbdb ?? -1;
const FELIDAE = pbdbOf(mammals, 'Felidae');
const PANTHERA = pbdbOf(mammals, 'Panthera');
/** The cats' story with the lion's genus picked out, and without. */
const LION: LifeStory = { group: 'mammals', pbdb: FELIDAE, focus: PANTHERA };
const CATS: LifeStory = { group: 'mammals', pbdb: FELIDAE, focus: null };

/** A group's file with a family of no genera: found by name, but with no finds to tell. */
const BARE = JSON.stringify({
  schemaVersion: 1,
  sources: ['pbdb'],
  credit: 'By hand',
  licence: 'CC BY 4.0',
  changes: 'Made by hand for this test.',
  source: 'https://paleobiodb.org/',
  accessed: '2026-11-01',
  id: 'mammals',
  name: 'Mammals',
  stepMa: 5,
  ranks: ['class', 'family', 'genus'],
  regions: ['North America'],
  pbdb: [1, 2, 3],
  names: ['Mammalia', 'Felidae', 'Felis'],
  common: ['mammal', 'cat', ''],
  living: [1, 1, 1],
  rank: [0, 1, 2],
  parent: [-1, 0, 0],
  first: [10, 10, 10],
  last: [0, 0, 0],
  sites: [[], [], [5, 10, 20, 3, 0, 15]],
  globe: [[5, 15]],
});

function mount(over: Served = {}, playing = false) {
  const files: Served = { ...REAL, ...over };
  const store = createStore<ViewState>(defaultViewState(new Date('2026-01-01T00:00:00Z')));
  const update = vi.fn<(shown: LifeMarks | null) => void>();
  const [flyTo, playFrom, notify] = [vi.fn(), vi.fn(), vi.fn()];
  const why = vi.fn<(id: string, label: string) => HTMLElement>(() => {
    const mark = document.createElement('button');
    mark.className = 'why-mark';
    return mark;
  });
  const context = {
    base: '/',
    fetchJson: (url: string) => {
      const body = files[url.replace('/data/life-stories/', '')];
      return typeof body === 'string'
        ? Promise.resolve(new Response(body))
        : Promise.reject(body ?? new Error(`nothing served at ${url}`));
    },
    store,
    notify,
    why,
    globe: { addLayer: () => ({ update }), flyTo },
    deepTime: {
      enterDeepTime: (ma: number) => {
        store.set((state) => ({ ...state, ma }));
      },
      playFrom,
      playing: () => playing,
    },
  } as unknown as LifeContext;
  const part = mountLife(context);
  // As the app does: the part is shown again when the view changes.
  store.subscribe((state) => {
    part.render(state);
  });
  document.body.append(...part.elements, part.button);
  const one = (selector: string): HTMLElement | null =>
    document.body.querySelector<HTMLElement>(selector);
  const all = (selector: string): HTMLElement[] => [
    ...document.body.querySelectorAll<HTMLElement>(selector),
  ];
  return {
    part,
    store,
    update,
    flyTo,
    playFrom,
    notify,
    why,
    one,
    all,
    panel: () => one('[data-testid="life-panel"]'),
    card: () => one('[data-testid="life-card"]'),
    title: () => one('.life-panel .life-title')?.textContent,
    /** What the marks layer was last given. */
    marks: () => update.mock.lastCall?.[0] ?? null,
    show: (life: LifeStory | null, ma: number | null): void => {
      store.set((state) => ({ ...state, life, ma }));
    },
    /** Show a story at a moment, and wait for its file. */
    told: async (life: LifeStory, ma: number | null, title: string): Promise<void> => {
      store.set((state) => ({ ...state, life, ma }));
      await vi.waitFor(() => {
        expect(one('.life-panel .life-title')?.textContent).toBe(title);
      });
    },
  };
}

type Mounted = ReturnType<typeof mount>;

/** Open the finder, wait for the groups' files, and type a name. */
async function find({ part, all }: Mounted, query: string): Promise<HTMLElement[]> {
  part.button.click();
  await vi.waitFor(() => {
    expect(all('.life-finder .famous-item').length).toBeGreaterThan(0);
  });
  const input = document.body.querySelector<HTMLInputElement>('.life-finder input');
  if (input === null) throw new Error('no finder');
  input.value = query;
  input.dispatchEvent(new Event('input'));
  return all('.life-finder .famous-item');
}

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('an animal’s story, as a part of the page', () => {
  it('holds the places of its panel, card and finder, and watches the story and the moment', () => {
    const { part, store, panel, card, update, why, one } = mount();
    // The mark that opens where the story comes from, asked for once, stands in the panel.
    expect(why).toHaveBeenCalledExactlyOnceWith('life', 'An animal’s story');
    expect(one('.life-panel .life-why .why-mark')).not.toBeNull();
    expect(part.elements).toHaveLength(3);
    expect(part.elements[0]).toBe(panel());
    expect(part.elements[1]).toBe(card());
    expect(part.elements[2]?.tagName).toBe('DIALOG');
    expect(part.button.textContent).toContain('Animals');
    expect(part.watches({ ...store.get(), life: LION, ma: 12 })).toEqual([LION, 12]);
    // With no story asked for: nothing shown, nothing marked.
    part.render(store.get());
    expect(panel()?.hidden).toBe(true);
    expect(card()?.hidden).toBe(true);
    expect(update).toHaveBeenLastCalledWith(null);
  });

  it('says the story is loading, then tells it and marks its sites of the moment', async () => {
    const mounted = mount();
    const { show, panel, title, marks, update, one } = mounted;
    show(LION, 10);
    expect(panel()?.hidden).toBe(false);
    expect(title()).toBe('Loading the story…');
    expect(update).toHaveBeenLastCalledWith(null);
    await vi.waitFor(() => {
      expect(title()).toBe('Lion');
    });
    const story = storyOf(mammals, FELIDAE, PANTHERA);
    if (story === null) throw new Error('no story of the cats');
    expect(marks()?.marks.map((mark) => mark.title)).toEqual(
      marksAt(story, 10).map((mark) => mark.title),
    );
    expect(marks()?.picked).toBeNull();
    expect(one('.life-now .life-when')?.textContent).toBe('10 million years ago');
    expect(one('.life-play')?.textContent).toBe('Play its story');
    // The pictures and the doors come with the first story, and it is drawn again with them.
    await vi.waitFor(() => {
      expect(one('.life-panel .life-emblem img')).not.toBeNull();
      expect(one('.life-row-name.is-heading')?.textContent).toBe('Doors');
    });
    expect(marks()?.silhouette('Panthera')?.of).toBe('Panthera onca');
    expect(marks()?.silhouette('No such animal')).toBeNull();
    // Its "First found in" moments now say by which door.
    expect(one('.life-chapters')?.textContent).toMatch(/Land joined it to|shallow sea/);
  });

  it('marks the sites again only as the step changes, and none outside deep time', async () => {
    const { told, show, marks, one, card } = mount();
    await told(CATS, 10, 'Cats');
    const key = marks()?.key;
    show(CATS, 9.2);
    expect(marks()?.key).toBe(key);
    show(CATS, 5);
    expect(marks()?.key).not.toBe(key);
    show(CATS, null);
    expect(marks()).toBeNull();
    expect(card()?.hidden).toBe(true);
    expect(one('.life-now')?.textContent).toBe(
      'Play its story, or tap the chart or a moment to go to its time.',
    );
  });

  it('says the story could not load when its group’s file does not come', async () => {
    const { show, title, notify, marks, one } = mount({ 'mammals.json': new Error('offline') });
    show(LION, 10);
    await vi.waitFor(() => {
      expect(title()).toBe('The story could not load.');
    });
    expect(notify).toHaveBeenCalledWith('Could not load the animals’ stories: offline');
    expect(marks()).toBeNull();
    expect(one('.life-body')?.hidden).toBe(true);
  });

  it('tells the story without pictures or doors when those files do not come', async () => {
    const { told, notify, marks, one } = mount({
      'pictures.json': new Error('no pictures'),
      'doors.json': new Error('no doors'),
    });
    await told(LION, 10, 'Lion');
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledTimes(2);
    });
    expect(notify).toHaveBeenCalledWith('Could not load the animals’ pictures: no pictures');
    expect(notify).toHaveBeenCalledWith('Could not load the continents’ doors: no doors');
    expect(marks()?.marks.length).toBeGreaterThan(0);
    expect(marks()?.silhouette('Panthera')).toBeNull();
    expect(one('.life-panel .life-emblem img')).toBeNull();
    expect(one('.life-row-name.is-heading')).toBeNull();
  });

  it('shows nothing for a lineage its group’s file does not have', async () => {
    const { show, panel, marks } = mount();
    show({ group: 'mammals', pbdb: 9_999_999, focus: null }, 10);
    await vi.waitFor(() => {
      expect(panel()?.hidden).toBe(true);
    });
    expect(marks()).toBeNull();
  });
});

describe('a site’s card in the story', () => {
  it('opens for the dot picked, stays while its site is shown, and closes', async () => {
    const { told, show, marks, card, one } = mount();
    await told(LION, 10, 'Lion');
    const [mark] = marks()?.marks ?? [];
    if (mark === undefined) throw new Error('no marks');
    marks()?.pick(mark);
    expect(card()?.hidden).toBe(false);
    expect(one('.life-card .life-title')?.textContent).toBe('Panthera');
    expect(marks()?.picked?.site).toBe(mark.site);
    expect(marks()?.picked?.node).toBe(mark.node);
    // Still in the same step: the card stays.
    show(LION, 9);
    expect(card()?.hidden).toBe(false);
    one('.life-card .life-close')?.click();
    expect(card()?.hidden).toBe(true);
    expect(marks()?.picked).toBeNull();
  });

  it('closes when the story moves to a step its site is not in', async () => {
    const { told, show, marks, card } = mount();
    await told(LION, 10, 'Lion');
    const [mark] = marks()?.marks ?? [];
    if (mark === undefined) throw new Error('no marks');
    marks()?.pick(mark);
    expect(card()?.hidden).toBe(false);
    show(LION, 25);
    expect(card()?.hidden).toBe(true);
    expect(marks()?.picked).toBeNull();
  });

  it('tells the story of the kind on the card, in its own family', async () => {
    const { told, store, marks, card, one } = mount();
    await told({ group: 'mammals', pbdb: pbdbOf(mammals, 'Felinae'), focus: null }, 5, 'Felinae');
    const mark = marks()?.marks.find((each) => each.node.name === 'Panthera');
    if (mark === undefined) throw new Error('no Panthera among the Felinae');
    marks()?.pick(mark);
    one('.life-card .life-play')?.click();
    expect(store.get().life).toEqual(LION);
    expect(card()?.hidden).toBe(true);
    await vi.waitFor(() => {
      // Its story opens at its oldest finds.
      expect(store.get().ma).toBe(30);
    });
    expect(one('.life-panel .life-title')?.textContent).toBe('Lion');
  });

  it('goes to the kind’s oldest finds, the globe turned to them', async () => {
    const { told, store, marks, flyTo, one } = mount();
    await told(LION, 5, 'Lion');
    const [mark] = marks()?.marks ?? [];
    if (mark === undefined) throw new Error('no marks');
    marks()?.pick(mark);
    one('.life-card .life-other')?.click();
    expect(store.get().ma).toBe(10);
    expect(flyTo).toHaveBeenLastCalledWith(mark.node.sites[0]);
  });

  it('does nothing from a card left over once its story has closed or another group’s loads', async () => {
    const { told, show, store, marks, one } = mount();
    await told(LION, 10, 'Lion');
    const [mark] = marks()?.marks ?? [];
    if (mark === undefined) throw new Error('no marks');
    marks()?.pick(mark);
    const stale = one('.life-card .life-play');
    show(null, 10);
    stale?.click();
    expect(store.get().life).toBeNull();
    const other: LifeStory = { group: 'dinosaurs', pbdb: 1, focus: null };
    show(other, 70);
    stale?.click();
    expect(store.get().life).toBe(other);
  });
});

describe('the ways on from the story’s panel', () => {
  it('closes the story', async () => {
    const { told, store, panel, marks, one } = mount();
    await told(LION, 10, 'Lion');
    one('.life-panel .life-close')?.click();
    expect(store.get().life).toBeNull();
    expect(panel()?.hidden).toBe(true);
    expect(marks()).toBeNull();
  });

  it('plays from where the reader is, and offers to play from the start while it plays', async () => {
    const still = mount();
    await still.told(LION, 10, 'Lion');
    still.one('.life-play')?.click();
    // Thirty million years in about 45 seconds.
    expect(still.playFrom).toHaveBeenCalledExactlyOnceWith(10, 'all', 30 / 45);
    document.body.replaceChildren();
    const playing = mount({}, true);
    await playing.told(LION, 10, 'Lion');
    expect(playing.one('.life-play')?.textContent).toBe('Play from the start');
    playing.one('.life-play')?.click();
    expect(playing.playFrom).toHaveBeenCalledExactlyOnceWith(30, 'all', 30 / 45);
  });

  it('turns the globe to each moment’s place as the story plays', async () => {
    const { told, show, flyTo } = mount({}, true);
    await told(LION, 30, 'Lion');
    flyTo.mockClear();
    show(LION, 25);
    expect(flyTo).toHaveBeenCalledOnce();
  });

  it('opens the finder for another animal', async () => {
    const { told, one } = mount();
    await told(LION, 10, 'Lion');
    const dialog = document.body.querySelector('dialog');
    expect(dialog?.open).toBe(false);
    one('.life-panel .life-other')?.click();
    expect(dialog?.open).toBe(true);
  });

  it('zooms out to an ancestor’s story and in to a branch’s, in the same group', async () => {
    const { told, store, all, title } = mount();
    await told(LION, 10, 'Lion');
    all('.life-crumb')[1]?.click();
    expect(store.get().life).toEqual({
      group: 'mammals',
      pbdb: pbdbOf(mammals, 'Carnivora'),
      focus: PANTHERA,
    });
    expect(title()).toMatch(/^Lion$/);
    all('.life-branch')[0]?.click();
    expect(store.get().life?.focus).toBeNull();
    expect(store.get().life?.pbdb).not.toBe(pbdbOf(mammals, 'Carnivora'));
  });

  it('goes to a moment, turning the globe to its place; to a step of the chart, without turning', async () => {
    const { told, store, flyTo, one, all } = mount();
    await told(CATS, 10, 'Cats');
    all('.life-chapter')[1]?.click();
    expect(store.get().ma).toBe(25);
    expect(flyTo).toHaveBeenCalledOnce();
    for (const row of all('.life-row')) {
      vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 700, 10));
    }
    one('.life-strip')?.dispatchEvent(new MouseEvent('click', { clientX: 690, bubbles: true }));
    expect(store.get().ma).toBe(0);
    expect(flyTo).toHaveBeenCalledOnce();
  });

  it('does nothing from the buttons of a story that has closed', async () => {
    const { told, show, store, playFrom, one, all } = mount();
    await told(LION, 10, 'Lion');
    show(null, 10);
    all('.life-crumb')[1]?.click();
    one('.life-play')?.click();
    expect(store.get().life).toBeNull();
    expect(playFrom).not.toHaveBeenCalled();
  });
});

describe('finding an animal and telling its story', () => {
  it('opens the story at its oldest finds, warmth on the globe, and plays after a moment', async () => {
    const mounted = mount();
    const { store, flyTo, playFrom, title } = mounted;
    const [lion] = await find(mounted, 'lion');
    vi.useFakeTimers();
    lion?.click();
    expect(store.get().life).toEqual(LION);
    expect(title()).toBe('Lion');
    await vi.advanceTimersByTimeAsync(0);
    expect(store.get().ma).toBe(30);
    expect(store.get().layers.has('temperature')).toBe(true);
    expect(flyTo).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(2499);
    expect(playFrom).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(playFrom).toHaveBeenCalledExactlyOnceWith(30, 'all', 30 / 45);
  });

  it('does not play a story the reader closed, or left for another moment, meanwhile', async () => {
    const mounted = mount();
    const { store, show, playFrom, one } = mounted;
    const [lion] = await find(mounted, 'lion');
    vi.useFakeTimers();
    lion?.click();
    await vi.advanceTimersByTimeAsync(0);
    one('.life-panel .life-close')?.click();
    await vi.advanceTimersByTimeAsync(2500);
    expect(playFrom).not.toHaveBeenCalled();
    const [again] = await find(mounted, 'lion');
    again?.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.get().ma).toBe(30);
    show(LION, 20);
    await vi.advanceTimersByTimeAsync(2500);
    expect(playFrom).not.toHaveBeenCalled();
  });

  it('tells a lineage found by name as its own story, no kind picked out', async () => {
    const mounted = mount();
    const [cats] = await find(mounted, 'cats');
    cats?.click();
    expect(mounted.store.get().life).toEqual(CATS);
    expect(mounted.title()).toBe('Cats');
  });

  it('says a lineage with no placed finds has no story to tell, and shows none', async () => {
    const mounted = mount({ 'mammals.json': BARE });
    const { store, notify, panel } = mounted;
    const [family] = await find(mounted, 'Felidae');
    expect(family?.textContent).toContain('a lineage (family)');
    family?.click();
    expect(store.get().life).toEqual({ group: 'mammals', pbdb: 2, focus: null });
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('That lineage has no placed finds to tell a story from.');
    });
    expect(store.get().life).toBeNull();
    expect(panel()?.hidden).toBe(true);
  });
});
