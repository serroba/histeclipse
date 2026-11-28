// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { parseLife, type LifeData } from '../../data/lifeStories';
import { loadLifeDoors } from './lifeDoors';
import { loadLifePictures, type LifePictures } from './lifePictures';
import { createLifePanel } from './panel';
import { storyOf, type Story } from './story';

const FOLDER = join(import.meta.dirname, '../../../public/data/life-stories');
const text = (name: string): string => readFileSync(join(FOLDER, `${name}.json`), 'utf8');
const served = (name: string) => () => Promise.resolve(new Response(text(name)));
const mammals = parseLife(JSON.parse(text('mammals')));
const doors = await loadLifeDoors('doors.json', served('doors'));
const pictures = await loadLifePictures('pictures.json', served('pictures'));

const pbdbOf = (data: LifeData, name: string): number =>
  data.nodes.find((node) => node.name === name)?.pbdb ?? -1;

function told(clade: string, focus: string | null = null): Story {
  const story = storyOf(
    mammals,
    pbdbOf(mammals, clade),
    focus === null ? null : pbdbOf(mammals, focus),
  );
  if (story === null) throw new Error(`no story of ${clade}`);
  return story;
}

const cats = told('Felidae');
const lion = told('Felidae', 'Panthera');
const elephants = told('Proboscidea');

function opened() {
  const actions = {
    goTo: vi.fn(),
    open: vi.fn(),
    play: vi.fn(),
    find: vi.fn(),
    close: vi.fn(),
  };
  const panel = createLifePanel(actions);
  const { root } = panel;
  const one = (selector: string): HTMLElement | null => root.querySelector<HTMLElement>(selector);
  const all = (selector: string): HTMLElement[] => [
    ...root.querySelectorAll<HTMLElement>(selector),
  ];
  return { panel, actions, root, one, all };
}

describe('an animal’s story beside the globe', () => {
  it('is hidden until there is a story, then says whose it is and draws its parts', () => {
    const { panel, root, one, all } = opened();
    expect(root.hidden).toBe(true);
    expect(root.getAttribute('aria-label')).toBe('An animal’s story');
    panel.render(lion, 10, false);
    expect(root.hidden).toBe(false);
    expect(one('.life-title')?.textContent).toBe('Lion');
    expect(one('.life-subtitle')?.textContent).toMatch(/^Panthera, the genus of the lion, tiger/);
    expect(one('.life-crumbs')?.textContent).toBe(
      'Zoom out: mammal › carnivoran › Feliformia › Feloidea › cat',
    );
    expect(one('.life-chart-slot .life-chart .life-strip')).not.toBeNull();
    expect(all('.life-chapters > li')).toHaveLength(lion.chapters.length);
    expect(all('.life-branches .life-branch')).toHaveLength(10);
    expect(one('.life-body > .life-note a')?.textContent).toBe('the Paleobiology Database');
    expect(one('.life-play')?.textContent).toBe('Play its story');
    // With no pictures yet: no emblem, no lead picture, no credits.
    expect(one('.life-emblem')?.children).toHaveLength(0);
    expect(one('.life-lead-slot')?.children).toHaveLength(0);
    expect(one('.life-credits-slot')?.children).toHaveLength(0);
  });

  it('offers to play from the start while the story plays', () => {
    const { panel, one } = opened();
    panel.render(cats, 10, true);
    expect(one('.life-play')?.textContent).toBe('Play from the start');
    panel.render(cats, 10, false);
    expect(one('.life-play')?.textContent).toBe('Play its story');
  });

  it('hides again with no story', () => {
    const { panel, root } = opened();
    panel.render(cats, 10, false);
    panel.render(null, 10, false);
    expect(root.hidden).toBe(true);
    panel.render(cats, 10, false);
    expect(root.hidden).toBe(false);
  });

  it('says the story is loading or could not load in place of its parts, until it comes', () => {
    const { panel, root, one } = opened();
    panel.say('Loading the story…');
    expect(root.hidden).toBe(false);
    expect(one('.life-title')?.textContent).toBe('Loading the story…');
    expect(one('.life-subtitle')?.textContent).toBe('');
    expect(one('.life-body')?.hidden).toBe(true);
    panel.render(cats, 10, false);
    expect(one('.life-title')?.textContent).toBe('Cats');
    expect(one('.life-body')?.hidden).toBe(false);
    // Said over a story shown, the story is drawn again when it is back.
    panel.say('The story could not load.');
    expect(one('.life-title')?.textContent).toBe('The story could not load.');
    panel.render(cats, 10, false);
    expect(one('.life-title')?.textContent).toBe('Cats');
  });

  it('draws a story once, and again only for another', () => {
    const { panel, one } = opened();
    panel.render(cats, 10, false);
    const chart = one('.life-chart');
    panel.render(cats, 5, false);
    expect(one('.life-chart')).toBe(chart);
    panel.render(elephants, 5, false);
    expect(one('.life-chart')).not.toBe(chart);
    expect(one('.life-title')?.textContent).toBe('Elephants');
  });
});

describe('where the story comes from', () => {
  it('has the mark that opens its sources after its note, when given one, and none otherwise', () => {
    const why = document.createElement('button');
    const panel = createLifePanel(
      { goTo: vi.fn(), open: vi.fn(), play: vi.fn(), find: vi.fn(), close: vi.fn() },
      why,
    );
    const slot = panel.root.querySelector('p.life-why');
    expect(slot?.firstElementChild).toBe(why);
    expect(slot?.previousElementSibling?.className).toBe('life-note');
    expect(opened().one('.life-why')).toBeNull();
  });
});

describe('the moment the story is shown at', () => {
  it('says what the step holds, puts the playhead on it, and marks the moments past and now', () => {
    const { panel, one, all } = opened();
    panel.render(cats, 5.4, false);
    expect(one('.life-now .life-when')?.textContent).toBe('5 million years ago');
    expect(one('.life-now')?.getAttribute('aria-live')).toBe('polite');
    expect(one('.life-now .life-change.is-began')).not.toBeNull();
    const playhead = one('.life-playhead');
    expect(playhead?.hidden).toBe(false);
    expect(playhead?.style.getPropertyValue('--life-at')).toBe(String(5.5 / 7));
    const moments = all('.life-chapters > li');
    const marked = (name: string): (string | null)[] =>
      moments
        .filter((item) => item.classList.contains(name))
        .map((item) => item.getAttribute('data-ma'));
    expect(marked('is-past')).toEqual(['30', '25', '20', '20', '15']);
    expect(marked('is-now')).toEqual(['5', '5', '5']);
    panel.render(cats, 0, false);
    expect(marked('is-now')).toEqual(['0']);
    expect(one('.life-now .life-when')?.textContent).toBe('The last 2.5 million years');
  });

  it('takes the playhead off at a moment outside the story', () => {
    const { panel, one } = opened();
    panel.render(cats, 100, false);
    expect(one('.life-playhead')?.hidden).toBe(true);
    expect(one('.life-now')?.textContent).toBe(
      '100 million years agoBefore the oldest finds, 30 million years ago.',
    );
  });

  it('outside deep time, says how to begin and marks no step', () => {
    const { panel, one } = opened();
    panel.render(cats, 5, false);
    panel.render(cats, null, false);
    expect(one('.life-playhead')?.hidden).toBe(true);
    expect(one('.life-now')?.textContent).toBe(
      'Play its story, or tap the chart or a moment to go to its time.',
    );
  });
});

describe('the ways on from a story', () => {
  it('plays, looks for another animal and closes by its buttons', () => {
    const { panel, actions, one } = opened();
    panel.render(cats, 10, false);
    one('.life-play')?.click();
    expect(actions.play).toHaveBeenCalledOnce();
    expect(one('.life-other')?.textContent).toBe('Another animal');
    one('.life-other')?.click();
    expect(actions.find).toHaveBeenCalledOnce();
    expect(one('.life-close')?.getAttribute('aria-label')).toBe('Close the story');
    one('.life-close')?.click();
    expect(actions.close).toHaveBeenCalledOnce();
  });

  it('folds away to its heading and back', () => {
    const { panel, root, one } = opened();
    panel.render(cats, 10, false);
    const fold = one('.life-fold');
    expect(fold?.getAttribute('aria-label')).toBe('Fold the story');
    fold?.click();
    expect(root.classList.contains('is-folded')).toBe(true);
    expect(fold?.textContent).toBe('+');
    expect(fold?.getAttribute('aria-label')).toBe('Show the story');
    fold?.click();
    expect(root.classList.contains('is-folded')).toBe(false);
    expect(fold?.textContent).toBe('–');
    expect(fold?.getAttribute('aria-label')).toBe('Fold the story');
  });

  it('zooms out to an ancestor’s story keeping the kind picked out, and in to a branch’s without', () => {
    const { panel, actions, all } = opened();
    panel.render(lion, 10, false);
    all('.life-crumb')[1]?.click();
    expect(actions.open).toHaveBeenLastCalledWith(
      pbdbOf(mammals, 'Carnivora'),
      pbdbOf(mammals, 'Panthera'),
    );
    all('.life-branch')[1]?.click();
    expect(actions.open).toHaveBeenLastCalledWith(pbdbOf(mammals, 'Felinae'), null);
    // With no kind picked out, none is kept.
    panel.render(cats, 10, false);
    all('.life-crumb')[0]?.click();
    expect(actions.open).toHaveBeenLastCalledWith(pbdbOf(mammals, 'Mammalia'), null);
  });

  it('goes to a moment’s time and place, or to a step tapped on the chart', () => {
    const { panel, actions, one, all } = opened();
    panel.render(cats, 10, false);
    all('.life-chapter')[2]?.click();
    expect(actions.goTo).toHaveBeenLastCalledWith(20, cats.chapters[2]?.where);
    for (const row of all('.life-row')) {
      vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 700, 10));
    }
    one('.life-strip')?.dispatchEvent(new MouseEvent('click', { clientX: 350, bubbles: true }));
    expect(actions.goTo).toHaveBeenLastCalledWith(15, null);
  });
});

describe('the story once its pictures and doors have loaded', () => {
  it('is drawn again with the animal’s silhouette, Wikipedia’s lead picture and the credits', () => {
    const { panel, one, all } = opened();
    panel.render(lion, 5, false);
    const before = one('.life-chart');
    panel.pictures(pictures);
    panel.render(lion, 5, false);
    expect(one('.life-chart')).not.toBe(before);
    const emblem = one('.life-emblem img.life-silhouette');
    expect(emblem?.getAttribute('width')).toBe('44');
    expect(emblem?.getAttribute('src')).toBe(pictures.names['Panthera']?.silhouette?.src);
    expect(one('.life-lead-slot figure.life-lead img')?.getAttribute('alt')).toBe(
      'Wikipedia’s lead picture for Panthera',
    );
    expect(all('.life-branch img.life-silhouette').length).toBeGreaterThan(0);
    expect(one('.life-credits-slot summary')?.textContent).toMatch(
      /^Silhouettes: \d+ from PhyloPic, credited here$/,
    );
    // The same pictures given again change nothing.
    const after = one('.life-chart');
    panel.pictures(pictures);
    panel.render(lion, 5, false);
    expect(one('.life-chart')).toBe(after);
  });

  it('keeps the credits open, if the reader opened them, as the moment changes', () => {
    const { panel, root } = opened();
    panel.pictures(pictures);
    panel.render(lion, 5, false);
    const credits = (): HTMLDetailsElement | null =>
      root.querySelector('.life-credits-slot details');
    expect(credits()?.open).toBe(false);
    panel.render(lion, 10, false);
    const shut = credits();
    expect(shut?.open).toBe(false);
    if (shut === null) throw new Error('no credits');
    shut.open = true;
    panel.render(lion, 15, false);
    expect(credits()).not.toBe(shut);
    expect(credits()?.open).toBe(true);
  });

  it('shows the lineage’s own silhouette and picture where the kind picked out has none', () => {
    const { panel, one } = opened();
    const felidae = pictures.names['Felidae'];
    if (felidae === undefined) throw new Error('no picture of the cats');
    const few: LifePictures = { ...pictures, names: { Felidae: felidae } };
    panel.pictures(few);
    panel.render(lion, 5, false);
    expect(one('.life-emblem img')?.getAttribute('src')).toBe(felidae.silhouette?.src);
    expect(one('.life-lead-slot img')?.getAttribute('alt')).toBe(
      'Wikipedia’s lead picture for Felidae',
    );
    // And with pictures of neither, none.
    panel.pictures({ ...pictures, names: {} });
    panel.render(lion, 5, false);
    expect(one('.life-emblem')?.children).toHaveLength(0);
    expect(one('.life-lead-slot')?.children).toHaveLength(0);
    expect(one('.life-credits-slot')?.children).toHaveLength(0);
  });

  it('is drawn again with the doors between its lands, in the chart and at the moment', () => {
    const { panel, one, all } = opened();
    panel.render(cats, 5, false);
    expect(one('.life-row-name.is-heading')).toBeNull();
    expect(one('.life-doors-now')).toBeNull();
    panel.doors(doors);
    panel.render(cats, 5, false);
    expect(one('.life-row-name.is-heading')?.textContent).toBe('Doors');
    expect(all('.life-row.is-door')).toHaveLength(5);
    expect(one('.life-doors-now')?.textContent).toMatch(/^Doors: joined by land: North America/);
    // The same doors given again change nothing.
    const chart = one('.life-chart');
    panel.doors(doors);
    panel.render(cats, 5, false);
    expect(one('.life-chart')).toBe(chart);
  });
});

describe('an animal’s story on a narrow screen', () => {
  /** A screen as wide as the query says, until the test ends. */
  function screen(narrow: boolean): void {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: narrow, media: query }));
  }

  it('starts folded to its heading when first told, with a way to play in reach', () => {
    screen(true);
    const { panel, actions, root, one } = opened();
    panel.render(lion, 10, false);
    expect(root.classList.contains('is-folded')).toBe(true);
    expect(one('.life-fold')?.getAttribute('aria-label')).toBe('Show the story');
    one('.life-play-folded')?.click();
    expect(actions.play).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it('stays as the reader left it while the same telling goes on, and folds again for a new one', () => {
    screen(true);
    const { panel, root, one } = opened();
    panel.say('Loading the story…');
    panel.render(lion, 10, false);
    one('.life-fold')?.click();
    expect(root.classList.contains('is-folded')).toBe(false);
    panel.render(lion, 5, false);
    panel.render(cats, 5, false);
    expect(root.classList.contains('is-folded')).toBe(false);
    panel.render(null, null, false);
    panel.render(lion, 10, false);
    expect(root.classList.contains('is-folded')).toBe(true);
    vi.unstubAllGlobals();
  });

  it('starts open on a wide screen', () => {
    screen(false);
    const { panel, root } = opened();
    panel.render(lion, 10, false);
    expect(root.classList.contains('is-folded')).toBe(false);
    vi.unstubAllGlobals();
  });
});
