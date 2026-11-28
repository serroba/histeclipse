/**
 * An animal's story beside the globe: whose it is and the lineages round it (out to its
 * ancestors, in to its branches); a chart of the story over time; what the moment shown holds;
 * and the moments worth stopping at. A tap on the chart or a moment goes there.
 */

import type { LifeNode } from '../../data/lifeStories';
import { element } from '../../ui/dom';
import { storyChart, type StoryChart } from './chart';
import { doorRows, type DoorRow } from './doors';
import type { LifeDoors } from './lifeDoors';
import type { LifePictures, Silhouette } from './lifePictures';
import { branchChips, button, chapterList, headingOf, noteOf, nowBox, trailOf } from './panelParts';
import { leadPicture, pictureOf, silhouetteCredits, silhouetteImage } from './pictures';
import { stepAt, type Story } from './story';

/** A screen too narrow for the panel to stand beside the globe. */
const NARROW = '(max-width: 600px)';

export interface PanelActions {
  /** Go to a moment, and turn the globe to a place if one is given. */
  readonly goTo: (ma: number, where: { latitude: number; longitude: number } | null) => void;
  /** Tell the story of another lineage of the same group, a kind picked out in it or not. */
  readonly open: (pbdb: number, focus: number | null) => void;
  readonly play: () => void;
  readonly find: () => void;
  readonly close: () => void;
}

export interface LifePanel {
  readonly root: HTMLElement;
  /** Show a story at a moment (null outside deep time), or nothing. */
  render(story: Story | null, ma: number | null, playing: boolean): void;
  /** Say that the story is loading, or could not load. */
  say(message: string): void;
  /** The continents' doors have loaded: the chart is drawn again with them. */
  doors(loaded: LifeDoors): void;
  /** The animals' pictures have loaded: the story is drawn again with them. */
  pictures(loaded: LifePictures): void;
}

/** The panel's elements, made once; `why` is the mark that opens where the story comes from. */
function frame(actions: PanelActions, why: HTMLElement | null) {
  const parts = {
    title: element('h2', { class: 'life-title' }),
    subtitle: element('p', { class: 'life-subtitle' }),
    emblem: element('span', { class: 'life-emblem' }),
    lead: element('div', { class: 'life-lead-slot' }),
    crumbs: element('nav', { class: 'life-crumbs', 'aria-label': 'Its ancestors' }),
    chart: element('div', { class: 'life-chart-slot' }),
    now: element('div', { class: 'life-now', 'aria-live': 'polite' }),
    chapters: element('ol', { class: 'life-chapters' }),
    within: element('div', { class: 'life-branches' }),
    note: element('p', { class: 'life-note' }),
    credits: element('div', { class: 'life-credits-slot' }),
    play: button('life-play', 'Play its story', actions.play),
  };
  const body = element(
    'div',
    { class: 'life-body' },
    parts.lead,
    parts.crumbs,
    element(
      'div',
      { class: 'life-actions' },
      parts.play,
      button('life-other', 'Another animal', actions.find),
    ),
    parts.chart,
    parts.now,
    element('h3', {}, 'Moments'),
    parts.chapters,
    element('h3', {}, 'Further in'),
    parts.within,
    parts.note,
    ...(why === null ? [] : [element('p', { class: 'life-why' }, why)]),
    parts.credits,
  );
  /** Fold the panel to its heading, or open it: on a phone it opens folded, clear of the globe. */
  const setFolded = (folded: boolean): void => {
    root.classList.toggle('is-folded', folded);
    fold.textContent = folded ? '+' : '–';
    fold.setAttribute('aria-label', folded ? 'Show the story' : 'Fold the story');
  };
  const fold = button('life-fold', '–', () => {
    setFolded(!root.classList.contains('is-folded'));
  });
  fold.setAttribute('aria-label', 'Fold the story');
  // Folded, the way to play stays in reach.
  const playFolded = button('life-play-folded', '▶', actions.play);
  playFolded.setAttribute('aria-label', 'Play its story');
  const close = button('life-close', '×', actions.close);
  close.setAttribute('aria-label', 'Close the story');
  const root = element(
    'aside',
    { class: 'life-panel', 'aria-label': 'An animal’s story', 'data-testid': 'life-panel' },
    element(
      'header',
      { class: 'life-header' },
      parts.emblem,
      element('div', { class: 'life-heading' }, parts.title, parts.subtitle),
      playFolded,
      fold,
      close,
    ),
    body,
  );
  root.hidden = true;
  return { ...parts, body, root, setFolded };
}

/** What the story's parts are drawn with, and what drawing them leaves to keep. */
interface Seen {
  readonly pictures: LifePictures | null;
  readonly doors: LifeDoors | null;
}
interface Drawn {
  readonly chart: StoryChart;
  readonly doorRows: readonly DoorRow[];
  /** The silhouettes shown with the story, for the credits. */
  readonly silhouettes: Silhouette[];
}

/** The parts that change only with the story: drawn once for each. */
function drawStory(
  made: ReturnType<typeof frame>,
  story: Story,
  seen: Seen,
  actions: PanelActions,
): Drawn {
  const { clade, focus } = story;
  const silhouettes: Silhouette[] = [];
  const subject = (focus ?? clade).name;
  const own =
    pictureOf(seen.pictures, subject)?.silhouette ??
    pictureOf(seen.pictures, clade.name)?.silhouette ??
    null;
  made.emblem.replaceChildren(...(own === null ? [] : [silhouetteImage(own, 44)]));
  if (own !== null) silhouettes.push(own);
  const picture = leadPicture(seen.pictures, subject) ?? leadPicture(seen.pictures, clade.name);
  made.lead.replaceChildren(...(picture === null ? [] : [picture]));
  const heading = headingOf(story);
  made.title.textContent = heading.title;
  made.subtitle.textContent = heading.subtitle;
  made.crumbs.replaceChildren(
    ...trailOf(story, (node: LifeNode) => {
      actions.open(node.pbdb, focus?.pbdb ?? null);
    }),
  );
  const rows = seen.doors === null ? [] : doorRows(story, seen.doors);
  const chart = storyChart(story, rows, (ma) => {
    actions.goTo(ma, null);
  });
  made.chart.replaceChildren(chart.root);
  made.chapters.replaceChildren(...chapterList(story, actions.goTo));
  made.within.replaceChildren(
    ...branchChips(
      story,
      seen.pictures,
      (node) => {
        actions.open(node.pbdb, null);
      },
      silhouettes,
    ),
  );
  made.note.replaceChildren(...noteOf(story));
  return { chart, doorRows: rows, silhouettes };
}

/** Mark each of the story's moments as past, now or to come at a step. */
function markChapters(chapters: HTMLElement, step: number): void {
  for (const item of chapters.children) {
    const ma = Number(item.getAttribute('data-ma'));
    item.classList.toggle('is-past', ma > step);
    item.classList.toggle('is-now', ma === step);
  }
}

export function createLifePanel(actions: PanelActions, why: HTMLElement | null = null): LifePanel {
  const made = frame(actions, why);
  /** The story drawn, with what drawing it left; null when it must be drawn again. */
  let kept: { readonly story: Story; readonly drawn: Drawn } | null = null;
  /** Whether a story was shown at the last render: a first showing may start folded. */
  let telling = false;
  let pictures: LifePictures | null = null;
  let doors: LifeDoors | null = null;

  function showCredits(silhouettes: readonly Silhouette[], ofMoment: readonly Silhouette[]): void {
    const list = silhouetteCredits([...silhouettes, ...ofMoment]);
    if (list !== null) list.open = made.credits.querySelector('details')?.open === true;
    made.credits.replaceChildren(...(list === null ? [] : [list]));
  }

  /** The parts that change with the moment. */
  function drawMoment(told: Story, drawn: Drawn, ma: number | null): void {
    const ofMoment: Silhouette[] = [];
    if (ma === null) {
      drawn.chart.mark(-1);
      made.now.replaceChildren(
        element('p', {}, 'Play its story, or tap the chart or a moment to go to its time.'),
      );
    } else {
      const step = stepAt(told, ma);
      drawn.chart.mark(told.steps.findIndex((each) => each.ma === step));
      made.now.replaceChildren(
        ...nowBox(told, step, ma, { pictures, doors: drawn.doorRows, shown: ofMoment }),
      );
      markChapters(made.chapters, step);
    }
    showCredits(drawn.silhouettes, ofMoment);
  }

  return {
    root: made.root,
    doors(loaded) {
      if (loaded !== doors) kept = null;
      doors = loaded;
    },
    pictures(loaded) {
      if (loaded !== pictures) kept = null;
      pictures = loaded;
    },
    say(message) {
      kept = null;
      made.root.hidden = false;
      made.title.textContent = message;
      made.subtitle.textContent = '';
      made.body.hidden = true;
    },
    render(told, ma, playing) {
      // Newly told on a narrow screen, it starts folded: the globe is the story.
      if (told !== null && !telling) made.setFolded(matchMedia(NARROW).matches);
      telling = told !== null;
      made.root.hidden = told === null;
      if (told === null) {
        kept = null;
        return;
      }
      made.body.hidden = false;
      if (kept?.story !== told) {
        kept = { story: told, drawn: drawStory(made, told, { pictures, doors }, actions) };
      }
      made.play.textContent = playing ? 'Play from the start' : 'Play its story';
      drawMoment(told, kept.drawn, ma);
    },
  };
}
