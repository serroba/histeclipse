/**
 * What an event's colours and marks on the globe are (#1268): a key under its clock, each
 * swatch drawn in the colour the globe draws it, named in words.
 */

import { element } from '../../ui/dom';

/** A mark or colour the globe draws for an event, keyed by its swatch's look. */
type LegendSwatch = 'cause' | 'record' | 'smoke' | 'lava' | 'basalt' | 'ice' | 'anoxia';

/** A swatch, and what it is in this event. */
export type LegendItem = readonly [swatch: LegendSwatch, label: string];

/** The key of `items`, or null if there are none. */
export function legendView(items: readonly LegendItem[]): HTMLElement | null {
  if (items.length === 0) return null;
  return element(
    'ul',
    { class: 'strike-clock-legend', 'aria-label': 'Key' },
    ...items.map(([swatch, label]) =>
      element(
        'li',
        {},
        element('span', { class: `legend-swatch legend-${swatch}`, 'aria-hidden': 'true' }),
        label,
      ),
    ),
  );
}
