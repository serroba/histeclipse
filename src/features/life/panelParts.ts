/**
 * The parts of an animal's story beside the globe, each built from the story: whose it is, the
 * trail of its ancestors (the way out), what the moment shown holds, its moments, and the
 * lineages within it (the ways in).
 */

import type { LifeNode } from '../../data/lifeStories';
import { element } from '../../ui/dom';
import { openAt, type DoorRow } from './doors';
import type { LifePictures, Silhouette } from './lifePictures';
import { everydayNames } from './names';
import { kindChip, pictureOf, silhouetteImage } from './pictures';
import { branches, type Story, type StoryStep } from './story';
import { capitalised, counted, listed, plainName } from './words';

/** The ranks of ancestors the trail names: the unranked clades between would be a page of names. */
const TRAIL_RANKS: ReadonlySet<string> = new Set([
  'class',
  'order',
  'suborder',
  'superfamily',
  'family',
  'subfamily',
]);

export function button(className: string, label: string, run: () => void): HTMLButtonElement {
  const made = element('button', { type: 'button', class: className }, label);
  made.addEventListener('click', run);
  return made;
}

/** Whose story it is: its everyday name where it has one, and what it is among its kin. */
export function headingOf(story: Story): { readonly title: string; readonly subtitle: string } {
  const { clade, focus, data } = story;
  const everyday = everydayNames(data.id, (focus ?? clade).name);
  const title = capitalised(everyday[0] ?? (focus === null ? plainName(clade) : focus.name));
  if (focus === null) {
    return {
      title,
      subtitle: `${clade.name} · ${counted(story.kinds, 'kind')} found as fossils, ${String(story.living)} living`,
    };
  }
  const also = everyday.length > 1 ? `, the genus of the ${listed(everyday)}` : '';
  return {
    title,
    subtitle: `${focus.name}${also}: one of ${String(story.kinds)} kinds of ${plainName(clade)} (${clade.name}) found as fossils, ${String(story.living)} of them living`,
  };
}

/** The story's ranked ancestors, each a way out to a wider story, the story's own last. */
export function trailOf(story: Story, open: (node: LifeNode) => void): (Node | string)[] {
  const trail = story.ancestry.filter(
    (node, at) => at === story.ancestry.length - 1 || TRAIL_RANKS.has(node.rank),
  );
  return [
    element('span', { class: 'life-crumbs-lead' }, 'Zoom out: '),
    ...trail.flatMap((node, at) => {
      const last = at === trail.length - 1;
      const crumb = button(`life-crumb${last ? ' is-here' : ''}`, plainName(node), () => {
        open(node);
      });
      crumb.title = `${node.name} (${node.rank})`;
      if (last) crumb.setAttribute('aria-current', 'true');
      return at === 0 ? [crumb] : [' › ', crumb];
    }),
  ];
}

/** The story's moments, each a way to its time and place. */
export function chapterList(
  story: Story,
  goTo: (ma: number, where: { latitude: number; longitude: number } | null) => void,
): HTMLElement[] {
  return story.chapters.map((chapter) => {
    const go = button('life-chapter', '', () => {
      goTo(chapter.ma, chapter.where);
    });
    go.append(
      element('span', { class: 'life-chapter-title' }, chapter.title),
      element('span', { class: 'life-chapter-text' }, chapter.text),
    );
    return element('li', { 'data-ma': String(chapter.ma) }, go);
  });
}

/** The lineages within the story's, each a way in; `shown` takes their silhouettes' credits. */
export function branchChips(
  story: Story,
  pictures: LifePictures | null,
  open: (node: LifeNode) => void,
  shown: Silhouette[],
): HTMLElement[] {
  const inner = branches(story);
  if (inner.length === 0) {
    return [element('p', { class: 'life-note' }, 'No lineages further in: this is a single kind.')];
  }
  return inner.map(({ node, kinds }) => {
    const go = button('life-branch', '', () => {
      open(node);
    });
    const silhouette = pictureOf(pictures, node.name)?.silhouette ?? null;
    if (silhouette !== null) {
      go.append(silhouetteImage(silhouette, 20));
      shown.push(silhouette);
    }
    go.append(
      element('span', {}, capitalised(plainName(node))),
      element('span', { class: 'life-count' }, String(kinds)),
    );
    go.title = `${node.name} (${node.rank}): ${String(kinds)} kinds found`;
    return go;
  });
}

/** What a step holds, in a sentence or two; `step` is undefined outside the story's steps. */
export function nowText(story: Story, step: StoryStep | undefined, ma: number): string {
  if (step === undefined) {
    const first = story.steps[0]?.ma ?? 0;
    return ma > first
      ? `Before the oldest finds, ${String(first)} million years ago.`
      : 'After its last finds.';
  }
  const kinds = counted(step.kinds, 'kind');
  if (step.finds === 0) {
    return `No finds in this step: a gap in the record. ${kinds} known from before and after.`;
  }
  const regions = story.data.regions.filter((_, region) => (step.byRegion[region] ?? 0) > 0);
  const climate =
    step.celsius === null || step.globe === null
      ? ''
      : ` About ${String(Math.round(step.celsius))} °C where they lay; the globe averaged ${String(Math.round(step.globe))} °C.`;
  return `${kinds} known, found in ${listed(regions)}.${climate}`;
}

/** The doors open at a step of the chart, said in a line; nothing with no doors to chart. */
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

/** Up to six kinds, each with its silhouette and its page where it has them, and how many more. */
function kindsLine(
  label: 'First found' | 'Last found',
  nodes: readonly LifeNode[],
  pictures: LifePictures | null,
  shown: Silhouette[],
): HTMLElement[] {
  if (nodes.length === 0) return [];
  const named = nodes.slice(0, 6);
  const more = nodes.length - named.length;
  return [
    element(
      'p',
      { class: `life-change is-${label === 'First found' ? 'began' : 'ended'}` },
      element('strong', {}, `${label}: `),
      ...named.map((node) => kindChip(node, pictures, shown)),
      ...(more > 0 ? [` and ${String(more)} more`] : []),
    ),
  ];
}

/** What the step at `step` Ma holds: when, what, its doors, and the kinds that began and ended. */
export function nowBox(
  story: Story,
  step: number,
  ma: number,
  seen: {
    readonly pictures: LifePictures | null;
    readonly doors: readonly DoorRow[];
    readonly shown: Silhouette[];
  },
): HTMLElement[] {
  const at = story.steps.findIndex((each) => each.ma === step);
  const here = story.steps[at];
  return [
    element(
      'p',
      { class: 'life-when' },
      step === 0 ? 'The last 2.5 million years' : `${String(step)} million years ago`,
    ),
    element('p', {}, nowText(story, here, ma)),
    ...doorsNow(seen.doors, at),
    ...kindsLine('First found', here?.began ?? [], seen.pictures, seen.shown),
    ...kindsLine('Last found', here?.ended ?? [], seen.pictures, seen.shown),
  ];
}

/** What the story is made of, and what it cannot say. */
export function noteOf(story: Story): (Node | string)[] {
  return [
    'Each dot is a place fossils were found, where it lay then: finds, not ranges, and far more has been dug in North America and Europe than elsewhere. A kind is a genus. Temperatures are modelled (Scotese 2022). Doors are read from the elevation maps (Scotese & Wright 2018), which can miss a narrow join: South America and Antarctica, held to have been joined until about 35 to 50 million years ago, read as apart. Finds: ',
    element(
      'a',
      { href: story.data.source, target: '_blank', rel: 'noopener' },
      'the Paleobiology Database',
    ),
    ` (CC BY 4.0), read ${story.data.accessed}.`,
  ];
}
