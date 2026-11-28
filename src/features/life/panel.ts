/**
 * An animal's story beside the globe (a prototype): whose it is and the lineages round it (out
 * to its ancestors, in to its branches); a chart of the story over time (where in today's world
 * its kinds were found, how warm it was where they lay beside the globe's mean, and how many
 * kinds there were); what the moment shown holds; and the moments worth stopping at. A tap on
 * the chart or a moment goes there.
 */

import type { LifeNode } from '../../data/lifeStories';
import { element } from '../../ui/dom';
import { LAND, SHELF, type LifeDoors } from '../../data/lifeDoors';
import type { LifePictures, Silhouette } from '../../data/lifePictures';
import { doorRows, openAt, type DoorRow } from './doors';
import { everydayNames } from './names';
import { kindChip, leadPicture, pictureOf, silhouetteCredits, silhouetteImage } from './pictures';
import { branches, listed, plainName, stepAt, type Story, type StoryStep } from './story';

const SVG = 'http://www.w3.org/2000/svg';

/** The ranks of ancestors the trail names. */
const TRAIL_RANKS: ReadonlySet<string> = new Set([
  'class',
  'order',
  'suborder',
  'superfamily',
  'family',
  'subfamily',
]);

/** The regions' names, short, for the chart's rows. */
const SHORT: Readonly<Record<string, string>> = {
  'North America': 'N America',
  'South America': 'S America',
};

export interface PanelActions {
  /** Go to a moment, and turn the globe to a place if one is given. */
  goTo(ma: number, where: { latitude: number; longitude: number } | null): void;
  /** Tell the story of another lineage of the same group, a kind picked out in it or not. */
  open(pbdb: number, focus: number | null): void;
  play(): void;
  find(): void;
  close(): void;
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

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function button(className: string, label: string, run: () => void): HTMLButtonElement {
  const made = element('button', { type: 'button', class: className }, label);
  made.addEventListener('click', run);
  return made;
}

function svg(tag: string, attributes: Readonly<Record<string, string>>): SVGElement {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

/** The two temperatures over the story's steps: where they lay, and the globe's mean. */
function temperatureChart(steps: readonly StoryStep[]): SVGElement {
  const [width, height] = [100, 34];
  const values = steps.flatMap((step) => [step.celsius, step.globe]).filter((v) => v !== null);
  const low = Math.min(...values, 10);
  const high = Math.max(...values, 20);
  const x = (at: number): number => ((at + 0.5) / steps.length) * width;
  const y = (celsius: number): number =>
    height - 2 - ((celsius - low) / (high - low)) * (height - 4);
  const line = (pick: (step: StoryStep) => number | null, className: string): SVGElement => {
    let path = '';
    let pen = false;
    steps.forEach((step, at) => {
      const value = pick(step);
      if (value === null) {
        pen = false;
        return;
      }
      path += `${pen ? 'L' : 'M'}${x(at).toFixed(2)} ${y(value).toFixed(2)}`;
      pen = true;
    });
    return svg('path', { d: path, class: className });
  };
  const chart = svg('svg', {
    viewBox: `0 0 ${String(width)} ${String(height)}`,
    preserveAspectRatio: 'none',
    class: 'life-temperature',
    role: 'img',
    'aria-label': `Temperature where they were found and the globe's mean, from ${String(Math.round(low))} to ${String(Math.round(high))} °C`,
  });
  chart.append(
    line((step) => step.globe, 'life-line is-globe'),
    line((step) => step.celsius, 'life-line is-found'),
  );
  // A dot where a step stands alone, which a line cannot show.
  steps.forEach((step, at) => {
    if (step.celsius === null) return;
    chart.append(
      svg('circle', {
        cx: x(at).toFixed(2),
        cy: y(step.celsius).toFixed(2),
        r: '0.9',
        class: 'life-point',
      }),
    );
  });
  return chart;
}

/** What a step holds, in a sentence or two. */
function nowText(story: Story, step: StoryStep | undefined, ma: number): string {
  if (step === undefined) {
    const [first] = story.steps;
    return first !== undefined && ma > first.ma
      ? `Before the oldest finds, ${String(first.ma)} million years ago.`
      : 'After its last finds.';
  }
  if (step.finds === 0) {
    return `No finds in this step: a gap in the record. ${String(step.kinds)} ${step.kinds === 1 ? 'kind is' : 'kinds are'} known from before and after.`;
  }
  const regions = story.data.regions.filter((_, region) => (step.byRegion[region] ?? 0) > 0);
  const climate =
    step.celsius === null || step.globe === null
      ? ''
      : ` About ${String(Math.round(step.celsius))} °C where they lay; the globe averaged ${String(Math.round(step.globe))} °C.`;
  return `${String(step.kinds)} ${step.kinds === 1 ? 'kind' : 'kinds'} known, found in ${listed(regions)}.${climate}`;
}

function namesLine(
  label: string,
  nodes: readonly LifeNode[],
  pictures: LifePictures | null,
  shown: Silhouette[],
): HTMLElement | null {
  if (nodes.length === 0) return null;
  const named = nodes.slice(0, 6);
  const more = nodes.length - named.length;
  return element(
    'p',
    { class: `life-change is-${label === 'First found' ? 'began' : 'ended'}` },
    element('strong', {}, `${label}: `),
    ...named.map((node) => kindChip(node, pictures, shown)),
    ...(more > 0 ? [` and ${String(more)} more`] : []),
  );
}

/** The doors open at a step of the chart, said in a line; nothing with none to say. */
function doorsNow(rows: readonly DoorRow[], at: number): HTMLElement[] {
  if (at < 0 || rows.length === 0) return [];
  const { land, shelf } = openAt(rows, at);
  const parts = [
    ...(land.length > 0 ? [`joined by land: ${land.join('; ')}`] : []),
    ...(shelf.length > 0 ? [`a shallow sea between: ${shelf.join('; ')}`] : []),
  ];
  return [
    element(
      'p',
      { class: 'life-doors-now' },
      element('strong', {}, 'Doors: '),
      parts.length === 0 ? 'sea between all the lands it was found on.' : `${parts.join('. ')}.`,
    ),
  ];
}

export function createLifePanel(actions: PanelActions): LifePanel {
  const title = element('h2', { class: 'life-title' });
  const subtitle = element('p', { class: 'life-subtitle' });
  const crumbs = element('nav', { class: 'life-crumbs', 'aria-label': 'Its ancestors' });
  const chart = element('div', { class: 'life-chart' });
  const playhead = element('i', { class: 'life-playhead' });
  const now = element('div', { class: 'life-now', 'aria-live': 'polite' });
  const chapters = element('ol', { class: 'life-chapters' });
  const within = element('div', { class: 'life-branches' });
  const note = element('p', { class: 'life-note' });
  const emblem = element('span', { class: 'life-emblem' });
  const lead = element('div', { class: 'life-lead-slot' });
  const credits = element('div', { class: 'life-credits-slot' });
  const play = button('life-play', 'Play its story', actions.play);
  const body = element(
    'div',
    { class: 'life-body' },
    lead,
    crumbs,
    element(
      'div',
      { class: 'life-actions' },
      play,
      button('life-other', 'Another animal', actions.find),
    ),
    chart,
    now,
    element('h3', {}, 'Moments'),
    chapters,
    element('h3', {}, 'Further in'),
    within,
    note,
    credits,
  );
  const fold = button('life-fold', '–', () => {
    const folded = root.classList.toggle('is-folded');
    fold.textContent = folded ? '+' : '–';
    fold.setAttribute('aria-label', folded ? 'Show the story' : 'Fold the story');
  });
  fold.setAttribute('aria-label', 'Fold the story');
  const close = button('life-close', '×', actions.close);
  close.setAttribute('aria-label', 'Close the story');
  const root = element(
    'aside',
    { class: 'life-panel', 'aria-label': 'An animal’s story', 'data-testid': 'life-panel' },
    element(
      'header',
      { class: 'life-header' },
      emblem,
      element('div', { class: 'life-heading' }, title, subtitle),
      fold,
      close,
    ),
    body,
  );
  root.hidden = true;

  let drawn: Story | null = null;
  let strip: HTMLElement | null = null;
  let loaded: LifePictures | null = null;
  let doors: LifeDoors | null = null;
  let doorsShown: readonly DoorRow[] = [];
  /** The silhouettes shown with the story, and with the moment: credited together. */
  let ofStory: Silhouette[] = [];
  let ofMoment: Silhouette[] = [];

  function showCredits(): void {
    const list = silhouetteCredits([...ofStory, ...ofMoment]);
    const open = credits.querySelector('details')?.open === true;
    if (list instanceof HTMLDetailsElement) list.open = open;
    credits.replaceChildren(...(list === null ? [] : [list]));
  }

  /** The parts that change only with the story: drawn once for each. */
  function drawStory(story: Story): void {
    const { clade, focus, data } = story;
    const everyday = everydayNames(data.id, (focus ?? clade).name);
    title.textContent = capitalised(
      everyday[0] ?? (focus === null ? plainName(clade) : focus.name),
    );
    ofStory = [];
    const subject = (focus ?? clade).name;
    const own = pictureOf(loaded, subject)?.silhouette ?? pictureOf(loaded, clade.name)?.silhouette;
    emblem.replaceChildren(...(own == null ? [] : [silhouetteImage(own, 44)]));
    if (own != null) ofStory.push(own);
    const picture = leadPicture(loaded, subject) ?? leadPicture(loaded, clade.name);
    lead.replaceChildren(...(picture === null ? [] : [picture]));
    const also = everyday.length > 1 ? `, the genus of the ${listed(everyday)}` : '';
    subtitle.textContent =
      focus === null
        ? `${clade.name} · ${String(story.kinds)} kinds found as fossils, ${String(story.living)} living`
        : `${focus.name}${also}: one of ${String(story.kinds)} kinds of ${plainName(clade)} (${clade.name}) found as fossils, ${String(story.living)} of them living`;
    // Its ancestors, the ranked ones only: the unranked clades between would be a page of names.
    const trail = story.ancestry.filter(
      (node, at) => at === story.ancestry.length - 1 || TRAIL_RANKS.has(node.rank),
    );
    crumbs.replaceChildren(
      element('span', { class: 'life-crumbs-lead' }, 'Zoom out: '),
      ...trail.flatMap((node, at) => {
        const last = at === trail.length - 1;
        const crumb = button(`life-crumb${last ? ' is-here' : ''}`, plainName(node), () => {
          actions.open(node.pbdb, focus?.pbdb ?? null);
        });
        crumb.title = `${node.name} (${node.rank})`;
        if (last) crumb.setAttribute('aria-current', 'true');
        return at === 0 ? [crumb] : [' › ', crumb];
      }),
    );

    // The chart: a row for each part of today's world with finds, then the temperatures and
    // the kinds, over the same steps.
    const most = Math.max(1, ...story.steps.flatMap((step) => step.byRegion));
    const rows: HTMLElement[] = [];
    data.regions.forEach((region, at) => {
      if (!story.steps.some((step) => (step.byRegion[at] ?? 0) > 0)) return;
      rows.push(
        element('span', { class: 'life-row-name' }, SHORT[region] ?? region),
        element(
          'span',
          { class: 'life-row' },
          ...story.steps.map((step) => {
            const finds = step.byRegion[at] ?? 0;
            const cell = element('i', { class: finds > 0 ? 'life-cell is-on' : 'life-cell' });
            if (finds > 0) {
              cell.style.opacity = String(0.35 + 0.65 * (Math.log1p(finds) / Math.log1p(most)));
              cell.title = `${region}, ${String(step.ma)} Ma: ${String(finds)} finds`;
            }
            return cell;
          }),
        ),
      );
    });
    // The doors between the lands it was found on: gold where land joined them, pale where
    // only a shallow sea lay between.
    doorsShown = doors === null ? [] : doorRows(story, doors);
    if (doorsShown.length > 0) {
      rows.push(
        element('span', { class: 'life-row-name is-heading' }, 'Doors'),
        element('span', { class: 'life-row-key' }, 'joined by land · shallow sea between'),
      );
    }
    for (const row of doorsShown) {
      rows.push(
        element(
          'span',
          { class: 'life-row-name is-door' },
          row.name.replace('North America', 'N Am').replace('South America', 'S Am'),
        ),
        element(
          'span',
          { class: 'life-row is-door' },
          ...row.states.map((state, at) => {
            const cell = element('i', {
              class: `life-cell${state === LAND ? ' is-land' : state === SHELF ? ' is-shelf' : ''}`,
            });
            const ma = story.steps[at]?.ma ?? 0;
            cell.title = `${row.name}, ${String(ma)} Ma: ${
              state === LAND
                ? 'joined by land'
                : state === SHELF
                  ? 'a shallow sea between'
                  : 'sea between'
            }, on the elevation maps`;
            return cell;
          }),
        ),
      );
    }
    const mostKinds = Math.max(1, ...story.steps.map((step) => step.kinds));
    const kinds = element(
      'span',
      { class: 'life-row is-kinds' },
      ...story.steps.map((step) => {
        const bar = element('i', { class: 'life-bar' });
        bar.style.height = `${String(Math.max(4, (step.kinds / mostKinds) * 100))}%`;
        bar.title = `${String(step.ma)} Ma: ${String(step.kinds)} kinds known`;
        return bar;
      }),
    );
    const temperatures = element('span', { class: 'life-row is-temperature' });
    temperatures.append(temperatureChart(story.steps));
    const [oldest] = story.steps;
    const youngest = story.steps.at(-1);
    strip = element(
      'div',
      { class: 'life-strip' },
      ...rows,
      element(
        'span',
        { class: 'life-row-name' },
        element('span', { class: 'life-key is-found' }, '°C there'),
        element('span', { class: 'life-key is-globe' }, 'globe'),
      ),
      temperatures,
      element('span', { class: 'life-row-name' }, 'Kinds'),
      kinds,
      element('span', {}),
      element(
        'span',
        { class: 'life-axis' },
        element('span', {}, `${String(oldest?.ma ?? 0)} Ma`),
        element('span', {}, youngest?.ma === 0 ? 'today' : `${String(youngest?.ma ?? 0)} Ma`),
      ),
    );
    strip.addEventListener('click', (event) => {
      const row = strip?.querySelector('.life-row');
      if (!(row instanceof HTMLElement) || story.steps.length === 0) return;
      const box = row.getBoundingClientRect();
      const share = (event.clientX - box.left) / box.width;
      if (share < 0 || share > 1) return;
      const at = Math.min(story.steps.length - 1, Math.floor(share * story.steps.length));
      actions.goTo(story.steps[at]?.ma ?? 0, null);
    });
    chart.replaceChildren(strip, playhead);

    chapters.replaceChildren(
      ...story.chapters.map((chapter) => {
        const go = button('life-chapter', '', () => {
          actions.goTo(chapter.ma, chapter.where);
        });
        go.append(
          element('span', { class: 'life-chapter-title' }, chapter.title),
          element('span', { class: 'life-chapter-text' }, chapter.text),
        );
        return element('li', { 'data-ma': String(chapter.ma) }, go);
      }),
    );

    const inner = branches(story);
    within.replaceChildren(
      ...(inner.length === 0
        ? [element('p', { class: 'life-note' }, 'No lineages further in: this is a single kind.')]
        : inner.map(({ node, kinds: count }) => {
            const go = button('life-branch', '', () => {
              actions.open(node.pbdb, null);
            });
            const silhouette = pictureOf(loaded, node.name)?.silhouette;
            if (silhouette != null) {
              go.append(silhouetteImage(silhouette, 20));
              ofStory.push(silhouette);
            }
            go.append(
              element('span', {}, capitalised(plainName(node))),
              element('span', { class: 'life-count' }, String(count)),
            );
            go.title = `${node.name} (${node.rank}): ${String(count)} kinds found`;
            return go;
          })),
    );
    note.replaceChildren(
      'Each dot is a place fossils were found, where it lay then: finds, not ranges, and far more has been dug in North America and Europe than elsewhere. A kind is a genus. Temperatures are modelled (Scotese 2022). Doors are read from the elevation maps (Scotese & Wright 2018), which can miss a narrow join: South America and Antarctica, held to have been joined until about 35 to 50 million years ago, read as apart. Finds: ',
      element(
        'a',
        { href: data.source, target: '_blank', rel: 'noopener' },
        'the Paleobiology Database',
      ),
      ` (CC BY 4.0), read ${data.accessed}.`,
    );
  }

  return {
    root,
    doors(found) {
      doors = found;
      drawn = null;
    },
    pictures(pictures) {
      loaded = pictures;
      drawn = null;
    },
    say(message) {
      drawn = null;
      root.hidden = false;
      title.textContent = message;
      subtitle.textContent = '';
      body.hidden = true;
    },
    render(story, ma, playing) {
      if (story === null) {
        root.hidden = true;
        drawn = null;
        return;
      }
      root.hidden = false;
      body.hidden = false;
      if (story !== drawn) {
        drawStory(story);
        drawn = story;
      }
      play.textContent = playing ? 'Play from the start' : 'Play its story';
      const [oldest] = story.steps;
      const youngest = story.steps.at(-1);
      if (ma === null || oldest === undefined || youngest === undefined) {
        playhead.hidden = true;
        now.replaceChildren(
          element('p', {}, 'Play its story, or tap the chart or a moment to go to its time.'),
        );
        return;
      }
      const step = stepAt(story, ma);
      const here = story.steps.find((each) => each.ma === step);
      const at = story.steps.findIndex((each) => each.ma === step);
      playhead.hidden = at < 0;
      if (at >= 0) {
        playhead.style.setProperty('--life-at', String((at + 0.5) / story.steps.length));
      }
      ofMoment = [];
      now.replaceChildren(
        element(
          'p',
          { class: 'life-when' },
          step === 0 ? 'The last 2.5 million years' : `${String(step)} million years ago`,
        ),
        element('p', {}, nowText(story, here, ma)),
        ...doorsNow(doorsShown, at),
        ...[
          namesLine('First found', here?.began ?? [], loaded, ofMoment),
          namesLine('Last found', here?.ended ?? [], loaded, ofMoment),
        ].flatMap((line) => (line === null ? [] : [line])),
      );
      showCredits();
      for (const item of chapters.children) {
        if (!(item instanceof HTMLElement)) continue;
        const chapterMa = Number(item.dataset['ma']);
        item.classList.toggle('is-past', chapterMa > step);
        item.classList.toggle('is-now', chapterMa === step);
      }
    },
  };
}
