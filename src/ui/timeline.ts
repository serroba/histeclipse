/**
 * The bottom bar: step or type a year, and pick one of that year's eclipses.
 * Mobile first: 44 px tap targets, a horizontally scrolling eclipse list, safe-area padding.
 */

import type { LunarEclipse } from '../data/lunarCatalog';
import type { SolarEclipse } from '../data/solarCatalog';
import { eclipseMoment, isSolar } from '../eclipses/describe';
import { astronomicalYear, formatYear, type AstronomicalYear } from '../time/year';
import { parseYearInput } from '../time/yearInput';
import { errorMessage } from '../util/errors';
import { element } from './dom';

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export type Eclipse = LunarEclipse | SolarEclipse;

export type YearEclipses =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly eclipses: readonly Eclipse[] }
  | { readonly status: 'error'; readonly message: string };

export interface TimelineView {
  readonly year: AstronomicalYear;
  readonly eclipses: YearEclipses;
  readonly selected: Eclipse | undefined;
}

export interface Timeline {
  readonly root: HTMLElement;
  render(view: TimelineView): void;
}

export function createTimeline(handlers: {
  onYear(year: AstronomicalYear): void;
  onSelect(eclipse: Eclipse): void;
}): Timeline {
  const input = element('input', {
    id: 'year-input',
    class: 'year-input',
    autocomplete: 'off',
    enterkeyhint: 'go',
    spellcheck: 'false',
    'aria-describedby': 'year-hint',
  });
  const hint = element(
    'span',
    { id: 'year-hint', class: 'visually-hidden' },
    'Type a year like 621 BCE or 2025',
  );
  const previous = element(
    'button',
    { type: 'button', class: 'step', 'aria-label': 'Previous year' },
    '‹',
  );
  const next = element('button', { type: 'button', class: 'step', 'aria-label': 'Next year' }, '›');
  const form = element(
    'form',
    { class: 'year-form' },
    element('label', { for: 'year-input', class: 'visually-hidden' }, 'Year'),
    input,
    hint,
  );
  const list = element('ul', { class: 'eclipse-list', 'aria-label': 'Eclipses this year' });
  const root = element(
    'nav',
    { class: 'timeline', 'aria-label': 'Year and eclipses' },
    element('div', { class: 'year-controls' }, previous, form, next),
    list,
  );

  let year = astronomicalYear(2000);
  previous.addEventListener('click', () => {
    handlers.onYear(astronomicalYear(year - 1));
  });
  next.addEventListener('click', () => {
    handlers.onYear(astronomicalYear(year + 1));
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const typed = parseYearInput(input.value);
      input.removeAttribute('aria-invalid');
      input.blur();
      handlers.onYear(typed);
    } catch (error) {
      input.setAttribute('aria-invalid', 'true');
      hint.textContent = errorMessage(error);
    }
  });

  return {
    root,
    render(view) {
      year = view.year;
      if (document.activeElement !== input) input.value = formatYear(view.year);
      hint.textContent = 'Type a year like 621 BCE or 2025';
      const listing = view.eclipses;
      if (listing.status === 'loading') {
        list.replaceChildren(element('li', { class: 'eclipse-empty' }, 'Loading…'));
        return;
      }
      if (listing.status === 'error') {
        list.replaceChildren(element('li', { class: 'eclipse-empty' }, listing.message));
        return;
      }
      if (listing.eclipses.length === 0) {
        list.replaceChildren(element('li', { class: 'eclipse-empty' }, 'No eclipses this year'));
        return;
      }
      list.replaceChildren(
        ...listing.eclipses.map((eclipse) => {
          const { date } = eclipseMoment(eclipse);
          const month = SHORT_MONTHS[date.month - 1] ?? '';
          const body = isSolar(eclipse) ? 'solar' : 'lunar';
          const kind = `${eclipse.kind[0]?.toUpperCase() ?? ''}${eclipse.kind.slice(1)} ${body}`;
          const chip = element(
            'button',
            {
              type: 'button',
              class: `eclipse-chip body-${body} kind-${eclipse.kind}`,
              'aria-pressed': String(eclipse === view.selected),
            },
            element('span', { class: 'eclipse-dot', 'aria-hidden': 'true' }),
            element('span', { class: 'eclipse-date' }, `${String(Math.floor(date.day))} ${month}`),
            element('span', { class: 'eclipse-kind' }, kind),
          );
          chip.addEventListener('click', () => {
            handlers.onSelect(eclipse);
          });
          return element('li', {}, chip);
        }),
      );
    },
  };
}
