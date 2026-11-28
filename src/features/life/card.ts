/**
 * A site's card in an animal's story: tapped on the globe, a dot says which kind was found
 * there and what is known of it: its picture and line of ancestors, this site (how many finds,
 * when, where it lay then and where that is today, how warm it was), the kind's whole record,
 * and the ways on: its own story, its page on Wikipedia, its finds at the source.
 */

import type { LifeData, LifeNode } from '../../data/lifeStories';
import { element } from '../../ui/dom';
import { silhouetteCredit, type LifePictures } from './lifePictures';
import type { Mark } from './marks';
import { button } from './panelParts';
import { leadPicture, pictureOf, silhouetteImage } from './pictures';
import { counted, listed, plainName } from './words';

export interface LifeCard {
  readonly root: HTMLElement;
  /** Show a mark's card, or with null, none. */
  show(mark: Mark | null, data: LifeData | null, pictures: LifePictures | null): void;
}

export interface CardActions {
  /** Tell the story of this kind, in its own family. */
  readonly tell: (node: LifeNode) => void;
  /** Go to a moment, the globe turned to a place. */
  readonly goTo: (ma: number, where: { latitude: number; longitude: number }) => void;
  readonly close: () => void;
}

/** The ranks of ancestors a kind is said to be of. */
const LINEAGE_RANKS: ReadonlySet<string> = new Set(['class', 'order', 'family', 'subfamily']);

/** "30° N, 79° E". */
export function placeSaid(latitude: number, longitude: number): string {
  const ns = `${String(Math.abs(Math.round(latitude)))}° ${latitude >= 0 ? 'N' : 'S'}`;
  const ew = `${String(Math.abs(Math.round(longitude)))}° ${longitude >= 0 ? 'E' : 'W'}`;
  return `${ns}, ${ew}`;
}

/** The years a step centred on `ma` covers. */
export function spanSaid(ma: number, stepMa: number): string {
  const half = stepMa / 2;
  return ma === 0
    ? `in the last ${String(half)} million years`
    : `${String(ma + half)} to ${String(ma - half)} million years ago`;
}

/** A kind's ancestors by rank, nearest last: "mammal › carnivoran › cat". */
function lineage(data: LifeData, node: LifeNode): string {
  const names: string[] = [];
  for (let at = node.parent; at >= 0; at = data.nodes[at]?.parent ?? -1) {
    const ancestor = data.nodes[at];
    if (ancestor !== undefined && LINEAGE_RANKS.has(ancestor.rank)) {
      names.unshift(plainName(ancestor));
    }
  }
  return names.join(' › ');
}

function fact(label: string, value: string): HTMLElement {
  return element('div', { class: 'life-fact' }, element('dt', {}, label), element('dd', {}, value));
}

function status(mark: Mark): string {
  if (mark.node.living) return 'living today';
  return mark.kind === 'ended' ? 'extinct: these are among its last finds' : 'extinct';
}

function header(mark: Mark, data: LifeData, pictures: LifePictures | null, close: () => void) {
  const { node } = mark;
  const silhouette = pictureOf(pictures, node.name)?.silhouette ?? null;
  const shut = button('life-close', '×', close);
  shut.setAttribute('aria-label', 'Close');
  return element(
    'header',
    { class: 'life-header' },
    ...(silhouette === null
      ? []
      : [element('span', { class: 'life-emblem' }, silhouetteImage(silhouette, 44))]),
    element(
      'div',
      { class: 'life-heading' },
      element('h2', { class: 'life-title' }, node.name),
      element(
        'p',
        { class: 'life-subtitle' },
        [
          ...(node.common === '' ? [] : [node.common]),
          `a kind (genus) of ${lineage(data, node)}`,
          status(mark),
        ].join(' · '),
      ),
    ),
    shut,
  );
}

/** This site: its finds and when, where it lay then and is today, and how warm it was. */
function siteFacts({ site }: Mark, data: LifeData): HTMLElement {
  const globe = data.globe.get(site.ma);
  const beside = globe === undefined ? '' : `; the globe averaged ${String(Math.round(globe))} °C`;
  return element(
    'dl',
    { class: 'life-facts' },
    fact('Finds', `${String(site.finds)}, ${spanSaid(site.ma, data.stepMa)}`),
    fact(
      'Where',
      `${placeSaid(site.latitude, site.longitude)} then; in ${data.regions[site.region] ?? ''} today`,
    ),
    ...(site.celsius === null
      ? []
      : [
          fact(
            'Climate',
            `about ${String(Math.round(site.celsius))} °C there, a year’s mean${beside} (modelled)`,
          ),
        ]),
  );
}

/** When a kind's finds run from and to. */
function whenSaid(node: LifeNode, stepMa: number): string {
  const oldest = node.sites[0]?.ma ?? 0;
  const youngest = node.sites.at(-1)?.ma ?? 0;
  if (oldest === youngest) return spanSaid(oldest, stepMa);
  return `from about ${String(oldest)} to ${youngest === 0 ? 'the last few' : String(youngest)} million years ago`;
}

/** The kind's whole record: when, and where in today's world. */
function kindFacts(node: LifeNode, data: LifeData): HTMLElement {
  const regions = [...new Set(node.sites.map((each) => each.region))];
  const finds = node.sites.reduce((sum, each) => sum + each.finds, 0);
  return element(
    'dl',
    { class: 'life-facts' },
    fact('When', whenSaid(node, data.stepMa)),
    fact(
      'Where',
      `${listed(regions.map((region) => data.regions[region] ?? ''))}: ${counted(finds, 'find')} at ${counted(node.sites.length, 'site')}`,
    ),
  );
}

/** How a site is made, the kind at its source, and its silhouette's credit. */
function note(node: LifeNode, pictures: LifePictures | null): HTMLElement {
  const silhouette = pictureOf(pictures, node.name)?.silhouette ?? null;
  return element(
    'p',
    { class: 'life-note' },
    'A site is finds within 500 km of each other in a 5-million-year step, at their middle. ',
    element(
      'a',
      {
        href: `https://paleobiodb.org/classic/basicTaxonInfo?taxon_no=${String(node.pbdb)}`,
        target: '_blank',
        rel: 'noopener',
      },
      `${node.name} in the Paleobiology Database`,
    ),
    '.',
    ...(silhouette === null
      ? []
      : [
          ' Silhouette: ',
          element(
            'a',
            { href: silhouette.page, target: '_blank', rel: 'noopener' },
            silhouetteCredit(silhouette),
          ),
          ' (PhyloPic).',
        ]),
  );
}

export function createLifeCard(actions: CardActions): LifeCard {
  const root = element('aside', {
    class: 'life-card',
    'aria-label': 'A site of fossil finds',
    'data-testid': 'life-card',
  });
  root.hidden = true;

  return {
    root,
    show(mark, data, pictures) {
      root.hidden = mark === null || data === null;
      if (mark === null || data === null) {
        root.replaceChildren();
        return;
      }
      const { node } = mark;
      const [oldest] = node.sites;
      const lead = leadPicture(pictures, node.name);
      root.replaceChildren(
        header(mark, data, pictures, actions.close),
        element(
          'div',
          { class: 'life-body' },
          ...(lead === null ? [] : [lead]),
          element('h3', {}, 'This site'),
          siteFacts(mark, data),
          element('h3', {}, `All of ${node.name}’s finds`),
          kindFacts(node, data),
          element(
            'div',
            { class: 'life-actions' },
            button('life-play', 'Tell its story', () => {
              actions.tell(node);
            }),
            button('life-other', 'Go to its oldest finds', () => {
              if (oldest !== undefined) actions.goTo(oldest.ma, oldest);
            }),
          ),
          note(node, pictures),
        ),
      );
    },
  };
}
