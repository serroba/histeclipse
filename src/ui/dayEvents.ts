/**
 * The years bar's single days (#837): a chip for each event of the year shown, which opens its
 * view. The row is hidden in a year with none, and shows whether or not the eclipses are on.
 */

import { dayEventsIn, type DayEvent } from '../explore/dayEvents';
import type { Anchor } from '../text/passages';
import { MONTH_NAMES } from '../time/calendars';
import { element } from './dom';

import './dayEvents.css';

export interface DayEvents {
  readonly root: HTMLElement;
  /** Show the events of a year (astronomical); the same year again changes nothing. */
  render(year: number): void;
}

/** The row of the year's single days, each opening its view (as Explore does) with `open`. */
export function createDayEvents(open: (anchor: Anchor) => void): DayEvents {
  const list = element('ul', { class: 'day-events', 'aria-label': 'Events this year' });
  list.hidden = true;
  let shown: readonly DayEvent[] = [];
  return {
    root: list,
    render(year) {
      const events = dayEventsIn(year);
      if (events.length === shown.length && events.every((event, i) => event === shown[i])) {
        return;
      }
      shown = events;
      list.hidden = events.length === 0;
      list.replaceChildren(
        ...events.map((event) => {
          const date = `${String(event.day)} ${String(MONTH_NAMES[event.month - 1]).slice(0, 3)}`;
          const chip = element(
            'button',
            { type: 'button', class: 'day-event-chip' },
            element('span', { class: 'eclipse-date' }, date),
            element('span', { class: 'day-event-label' }, event.label),
          );
          chip.addEventListener('click', () => {
            open(event.anchor);
          });
          return element('li', {}, chip);
        }),
      );
    },
  };
}
