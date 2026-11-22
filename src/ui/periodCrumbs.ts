/**
 * Where the bar is in Earth's history, while it shows a part of it (#1075): Earth › Phanerozoic
 * › Mesozoic › Cretaceous, the units that hold all of the bar. Each fits the bar to itself, so
 * a tap goes out a level, or more; Earth shows all of its history.
 */

import { crumbsFor } from '../deepTime/chart';
import { EARTH_AGE_MA } from '../deepTime/scale';
import { element } from './dom';
import './periodCrumbs.css';

export interface PeriodCrumbs {
  readonly root: HTMLElement;
  /** The crumbs for the bar from `oldest` to `youngest` Ma; none while it shows a whole span. */
  render(oldest: number, youngest: number, part: boolean): void;
}

export function createPeriodCrumbs(
  /** Fit the bar to `oldest`–`youngest` Ma. */
  onFit: (oldest: number, youngest: number) => void,
): PeriodCrumbs {
  const root = element('nav', {
    class: 'period-crumbs',
    'aria-label': 'Where in Earth’s history',
    hidden: '',
  });
  let drawn = '';
  const crumb = (name: string, oldest: number, youngest: number, here: boolean) => {
    const button = element('button', { type: 'button', class: 'period-crumb' }, name);
    if (here) button.setAttribute('aria-current', 'location');
    button.title = here ? `${name}: the bar shows all of it` : `Show all of the ${name}`;
    button.addEventListener('click', () => {
      onFit(oldest, youngest);
    });
    return button;
  };
  return {
    root,
    render(oldest, youngest, part) {
      const key = part ? `${String(oldest)}:${String(youngest)}` : '';
      if (key === drawn) return;
      drawn = key;
      root.hidden = !part;
      if (!part) {
        root.replaceChildren();
        return;
      }
      const units = crumbsFor(oldest, youngest);
      const crumbs = [
        crumb('Earth', EARTH_AGE_MA, 0, false),
        ...units.map((unit) =>
          crumb(unit.name, unit.base, unit.top, unit.base === oldest && unit.top === youngest),
        ),
      ];
      root.replaceChildren(
        ...crumbs.flatMap((button, index) =>
          index === 0
            ? [button]
            : [element('span', { class: 'period-crumb-gap', 'aria-hidden': 'true' }, '›'), button],
        ),
      );
      // Where a phone's one line scrolls, the narrowest unit, where the bar is, in view.
      root.scrollLeft = root.scrollWidth;
    },
  };
}
