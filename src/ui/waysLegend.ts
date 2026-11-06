/**
 * The key to the ways-of-life shading on the map: a swatch and a name for each way of life
 * shown at the moment, always in the same order and the same colour, and what the strength of
 * the shading means.
 *
 * DOM glue, covered by the Playwright suite; `legendWays` is unit-tested.
 */

import { WAY_COLOURS } from '../globe/empireCanvas';
import { WAY_NAMES, WAYS, type Shown, type WaysAt } from '../data/waysOfLife';
import { element } from './dom';

export interface WaysLegend {
  readonly root: HTMLElement;
  /** The moment's ways of life; null hides the key. */
  render(at: WaysAt | null): void;
}

const ORDER: readonly Shown[] = [...WAYS, 'mixed'];

/** Short enough for one line on a phone; the Layers panel's note says what mixed means. */
const KEY_NAMES: Readonly<Record<Shown, string>> = { ...WAY_NAMES, mixed: 'mixed' };

/** The ways of life shown somewhere at the moment, in their fixed order. */
export function legendWays(at: WaysAt): Shown[] {
  return ORDER.filter((way) => at.counts[way] > 0);
}

export function createWaysLegend(): WaysLegend {
  // A list said as one, though laid out with the title (display: contents can drop the role).
  const list = element('ul', { class: 'ways-legend-list', role: 'list' });
  const items = new Map(
    ORDER.map((way) => {
      const swatch = element('span', { class: 'ways-swatch', 'aria-hidden': 'true' });
      swatch.style.background = `rgb(${WAY_COLOURS[way]})`;
      const item = element(
        'li',
        { 'data-way': way, title: WAY_NAMES[way] },
        swatch,
        KEY_NAMES[way],
      );
      list.append(item);
      return [way, item] as const;
    }),
  );
  const root = element(
    'div',
    {
      class: 'ways-legend',
      role: 'group',
      'aria-label': 'Ways of life',
      'data-testid': 'ways-legend',
      hidden: '',
    },
    element('span', { class: 'ways-legend-title' }, 'Ways of life'),
    list,
    element('span', { class: 'ways-legend-note' }, 'stronger where more widespread'),
  );
  return {
    root,
    render(at) {
      root.hidden = at === null;
      if (at === null) return;
      const shown = new Set(legendWays(at));
      for (const [way, item] of items) item.hidden = !shown.has(way);
    },
  };
}
