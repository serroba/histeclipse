/**
 * The animals' pictures as the story shows them : a kind's silhouette from
 * PhyloPic beside its name, the name a link to its Wikipedia page where it has one; Wikipedia's
 * lead picture for the animal the story is of; and the credits of every silhouette shown.
 */

import type { LifeNode } from '../../data/lifeStories';
import {
  silhouetteCredit,
  type LifePicture,
  type LifePictures,
  type Silhouette,
} from './lifePictures';
import { element } from '../../ui/dom';

export function pictureOf(pictures: LifePictures | null, name: string): LifePicture | null {
  return pictures?.names[name] ?? null;
}

/** A silhouette, drawn light on the dark panel; its credit is its tooltip. */
export function silhouetteImage(silhouette: Silhouette, size: number): HTMLImageElement {
  const image = element('img', {
    class: 'life-silhouette',
    src: silhouette.src,
    alt: '',
    width: String(size),
    height: String(size),
    loading: 'lazy',
    decoding: 'async',
    referrerpolicy: 'no-referrer',
  });
  image.title = `Silhouette: ${silhouetteCredit(silhouette)} (PhyloPic)`;
  return image;
}

/**
 * A kind by name, with its silhouette where it has one: a link to its Wikipedia page where it
 * has one, else plain. The silhouette, if shown, is added to `shown` for the credits.
 */
export function kindChip(
  node: LifeNode,
  pictures: LifePictures | null,
  shown: Silhouette[],
): HTMLElement {
  const picture = pictureOf(pictures, node.name);
  const parts: (Node | string)[] = [];
  const silhouette = picture?.silhouette ?? null;
  if (silhouette !== null) {
    parts.push(silhouetteImage(silhouette, 22));
    shown.push(silhouette);
  }
  parts.push(element('span', {}, node.name));
  const page = picture?.wikipedia ?? null;
  if (page === null) return element('span', { class: 'life-kind' }, ...parts);
  const link = element(
    'a',
    {
      class: 'life-kind is-linked',
      href: page.page,
      target: '_blank',
      rel: 'noopener',
    },
    ...parts,
  );
  link.title = `${node.name} on Wikipedia`;
  return link;
}

/** An author's credit as Commons gives it, cut where it runs to a paragraph: its page has it whole. */
function shortened(artist: string): string {
  return artist.length > 70
    ? `${artist.slice(0, 67).trimEnd()}… (credits in full on its page)`
    : artist;
}

/** Wikipedia's lead picture for a name, with its credit and the page; null if it has none. */
export function leadPicture(pictures: LifePictures | null, name: string): HTMLElement | null {
  const page = pictureOf(pictures, name)?.wikipedia ?? null;
  if (page === null) return null;
  const read = element(
    'a',
    { href: page.page, target: '_blank', rel: 'noopener' },
    `${name} on Wikipedia`,
  );
  if (page.image === null) return element('p', { class: 'life-reference' }, 'Read more: ', read);
  const { image } = page;
  return element(
    'figure',
    { class: 'life-lead' },
    element('img', {
      src: image.src,
      alt: `Wikipedia’s lead picture for ${name}`,
      width: String(image.width),
      height: String(image.height),
      loading: 'lazy',
      decoding: 'async',
      referrerpolicy: 'no-referrer',
    }),
    element(
      'figcaption',
      {},
      'Wikipedia’s lead picture for ',
      read,
      ', which may be a fossil, a reconstruction or a living animal. ',
      element(
        'a',
        { href: image.filePage, target: '_blank', rel: 'noopener' },
        `${shortened(image.artist)}, ${image.licence}`,
      ),
      ', via Wikimedia Commons.',
    ),
  );
}

/** The credits of the silhouettes shown, each once, folded away until asked for. */
export function silhouetteCredits(shown: readonly Silhouette[]): HTMLDetailsElement | null {
  const once = [...new Map(shown.map((each) => [each.page, each])).values()];
  if (once.length === 0) return null;
  return element(
    'details',
    { class: 'life-credits' },
    element('summary', {}, `Silhouettes: ${String(once.length)} from PhyloPic, credited here`),
    element(
      'ul',
      {},
      ...once.map((each) =>
        element(
          'li',
          {},
          element(
            'a',
            { href: each.page, target: '_blank', rel: 'noopener' },
            silhouetteCredit(each),
          ),
        ),
      ),
    ),
  );
}
