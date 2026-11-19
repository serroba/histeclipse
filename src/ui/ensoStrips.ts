/**
 * El Niño and La Niña as strips under a chart (#886, #890): one strip per index of the tropical
 * Pacific, each with its episodes, never merged, so where the indices disagree shows. Used by the
 * El Niño and La Niña panel and under the temperature records; each chart says where a month
 * starts on its own axis.
 */

import { monthNumber, shortName, type Enso, type Phase } from '../data/enso';
import { element } from './dom';
import './ensoStrips.css';

const SVG = 'http://www.w3.org/2000/svg';
/** The strips' height, in their own units. */
const STRIP_HEIGHT = 40;

export interface EpisodeStrip {
  readonly id: string;
  readonly name: string;
  /** Each episode, as a span of the chart's width. */
  readonly episodes: readonly {
    readonly x: number;
    readonly width: number;
    readonly phase: Exclude<Phase, 'neutral'>;
  }[];
}

/**
 * Each index's episodes across a chart `width` wide, where `startOf(month)` is the x at which a
 * month (months since January of year 0) starts; cut to the chart, and gone where outside it.
 */
export function episodeStrips(
  enso: Enso,
  startOf: (month: number) => number,
  width: number,
): EpisodeStrip[] {
  return enso.indices.map((index) => ({
    id: index.id,
    name: shortName(index),
    episodes: index.episodes.flatMap((episode) => {
      const from = Math.max(0, startOf(monthNumber(episode.first)));
      const to = Math.min(width, startOf(monthNumber(episode.last) + 1));
      return to > from ? [{ x: from, width: to - from, phase: episode.phase }] : [];
    }),
  }));
}

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string>>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

/** The strips as rows, each named, with the moment shown marked (none for null). */
export function stripRows(
  strips: readonly EpisodeStrip[],
  width: number,
  cursorX: number | null,
): HTMLElement[] {
  return strips.map((row) => {
    const drawn = svg('svg', {
      viewBox: `0 0 ${String(width)} ${String(STRIP_HEIGHT)}`,
      preserveAspectRatio: 'none',
      'aria-hidden': 'true',
      class: 'enso-strip',
    });
    drawn.append(
      ...row.episodes.map((episode) =>
        svg('rect', {
          x: episode.x.toFixed(1),
          width: episode.width.toFixed(1),
          y: '0',
          height: String(STRIP_HEIGHT),
          class: `enso-episode is-${episode.phase}`,
        }),
      ),
    );
    if (cursorX !== null) {
      const at = cursorX.toFixed(1);
      drawn.append(
        svg('line', { x1: at, x2: at, y1: '0', y2: String(STRIP_HEIGHT), class: 'enso-mark' }),
      );
    }
    return element('div', { class: `enso-row is-${row.id}` }, element('span', {}, row.name), drawn);
  });
}
