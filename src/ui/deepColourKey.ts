/**
 * What deep time's colours mean (#1075 moved it out of the bar): the map's, and the milestones'
 * ticks on the time line. Folded away, one of the bar's folds.
 */

import { MAP_KEY, MILESTONE_KEY } from '../deepTime/colourKey';
import { element } from './dom';

function swatch(background: string): HTMLElement {
  const box = element('span', { class: 'colour-swatch', 'aria-hidden': 'true' });
  box.style.background = background;
  return box;
}

/** The fold that says what the colours mean, sharing `name` with the bar's other folds. */
export function deepColourKey(name: string): HTMLDetailsElement {
  return element(
    'details',
    { class: 'deep-facts deep-key', 'data-testid': 'deep-key', name },
    element('summary', {}, 'What the colours mean'),
    element(
      'div',
      { class: 'colour-key-body' },
      element(
        'ul',
        { class: 'colour-key' },
        ...MAP_KEY.map(({ label, swatch: background }) =>
          element('li', {}, swatch(background), label),
        ),
      ),
      element('p', { class: 'colour-key-heading' }, 'Ticks on the time line: milestones'),
      element(
        'ul',
        { class: 'colour-key' },
        ...MILESTONE_KEY.map(({ kind, label }) =>
          element(
            'li',
            {},
            element('span', { class: `colour-tick milestone-${kind}`, 'aria-hidden': 'true' }),
            label,
          ),
        ),
      ),
      element(
        'p',
        { class: 'colour-key-heading' },
        'With Temperature on, the map shows °C instead, on the scale above.',
      ),
    ),
  );
}
