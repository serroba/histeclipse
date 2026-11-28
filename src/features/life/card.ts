/**
 * A site's card in an animal's story (a prototype): tapped on the globe, a dot says which kind
 * was found there and what is known of it: its picture and line of ancestors, this site (how
 * many finds, when, where it lay then and where that is today, how warm it was), the kind's
 * whole record, and the ways on: its own story, its page on Wikipedia, its finds at the source.
 */

import type { LifeData, LifeNode } from '../../data/lifeStories';
import { silhouetteCredit, type LifePictures } from '../../data/lifePictures';
import { element } from '../../ui/dom';
import { leadPicture, pictureOf, silhouetteImage } from './pictures';
import { listed, plainName, type Mark } from './story';

export interface LifeCard {
  readonly root: HTMLElement;
  /** Show a mark's card, or with null, none. */
  show(mark: Mark | null, data: LifeData | null, pictures: LifePictures | null): void;
}

function place(latitude: number, longitude: number): string {
  const ns = `${String(Math.abs(Math.round(latitude)))}° ${latitude >= 0 ? 'N' : 'S'}`;
  const ew = `${String(Math.abs(Math.round(longitude)))}° ${longitude >= 0 ? 'E' : 'W'}`;
  return `${ns}, ${ew}`;
}

function span(ma: number, stepMa: number): string {
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
    if (ancestor === undefined) break;
    if (['class', 'order', 'family', 'subfamily'].includes(ancestor.rank)) {
      names.unshift(plainName(ancestor));
    }
  }
  return names.join(' › ');
}

function row(label: string, value: string): HTMLElement {
  return element('div', { class: 'life-fact' }, element('dt', {}, label), element('dd', {}, value));
}

export function createLifeCard(actions: {
  /** Tell the story of this kind, in its own family. */
  tell(node: LifeNode): void;
  /** Go to a moment, the globe turned to a place. */
  goTo(ma: number, where: { latitude: number; longitude: number }): void;
  close(): void;
}): LifeCard {
  const root = element('aside', {
    class: 'life-card',
    'aria-label': 'A site of fossil finds',
    'data-testid': 'life-card',
  });
  root.hidden = true;

  return {
    root,
    show(mark, data, pictures) {
      if (mark === null || data === null) {
        root.hidden = true;
        root.replaceChildren();
        return;
      }
      const { node, site } = mark;
      const picture = pictureOf(pictures, node.name);
      const close = element(
        'button',
        { type: 'button', class: 'life-close', 'aria-label': 'Close' },
        '×',
      );
      close.addEventListener('click', actions.close);
      const sites = node.sites;
      const oldest = sites[0];
      const youngest = sites.at(-1);
      const regions = [...new Set(sites.map((each) => each.region))].map(
        (region) => data.regions[region] ?? '',
      );
      const finds = sites.reduce((sum, each) => sum + each.finds, 0);
      const globe = data.globe.get(site.ma);
      const tell = element('button', { type: 'button', class: 'life-play' }, 'Tell its story');
      tell.addEventListener('click', () => {
        actions.tell(node);
      });
      const first = element(
        'button',
        { type: 'button', class: 'life-other' },
        'Go to its oldest finds',
      );
      first.addEventListener('click', () => {
        if (oldest !== undefined) actions.goTo(oldest.ma, oldest);
      });
      const lead = leadPicture(pictures, node.name);
      root.replaceChildren(
        element(
          'header',
          { class: 'life-header' },
          ...(picture?.silhouette == null
            ? []
            : [element('span', { class: 'life-emblem' }, silhouetteImage(picture.silhouette, 44))]),
          element(
            'div',
            { class: 'life-heading' },
            element('h2', { class: 'life-title' }, node.name),
            element(
              'p',
              { class: 'life-subtitle' },
              [
                node.common === '' ? null : node.common,
                `a kind (genus) of ${lineage(data, node)}`,
                node.living
                  ? 'living today'
                  : mark.kind === 'ended'
                    ? 'extinct: these are among its last finds'
                    : 'extinct',
              ]
                .filter((part) => part !== null)
                .join(' · '),
            ),
          ),
          close,
        ),
        element(
          'div',
          { class: 'life-body' },
          ...(lead === null ? [] : [lead]),
          element('h3', {}, 'This site'),
          element(
            'dl',
            { class: 'life-facts' },
            row('Finds', `${String(site.finds)}, ${span(site.ma, data.stepMa)}`),
            row(
              'Where',
              `${place(site.latitude, site.longitude)} then; in ${data.regions[site.region] ?? ''} today`,
            ),
            ...(site.celsius === null
              ? []
              : [
                  row(
                    'Climate',
                    `about ${String(Math.round(site.celsius))} °C there, a year’s mean${
                      globe === undefined
                        ? ''
                        : `; the globe averaged ${String(Math.round(globe))} °C`
                    } (modelled)`,
                  ),
                ]),
          ),
          element('h3', {}, `All of ${node.name}’s finds`),
          element(
            'dl',
            { class: 'life-facts' },
            row(
              'When',
              oldest === undefined || youngest === undefined
                ? ''
                : oldest.ma === youngest.ma
                  ? span(oldest.ma, data.stepMa)
                  : `from about ${String(oldest.ma)} to ${youngest.ma === 0 ? 'the last few' : String(youngest.ma)} million years ago`,
            ),
            row(
              'Where',
              `${listed(regions)}: ${String(finds)} finds at ${String(sites.length)} sites`,
            ),
          ),
          element('div', { class: 'life-actions' }, tell, first),
          element(
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
            ...(picture?.silhouette == null
              ? []
              : [
                  ' Silhouette: ',
                  element(
                    'a',
                    { href: picture.silhouette.page, target: '_blank', rel: 'noopener' },
                    silhouetteCredit(picture.silhouette),
                  ),
                  ' (PhyloPic).',
                ]),
          ),
        ),
      );
      root.hidden = false;
    },
  };
}
