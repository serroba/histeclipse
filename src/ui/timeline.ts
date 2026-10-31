/**
 * The bottom bar: step or type a year, and pick one of that year's eclipses.
 * Mobile first: 44 px tap targets, a horizontally scrolling eclipse list, safe-area padding.
 */

import type { LunarEclipse } from '../data/lunarCatalog';
import { describeLunarEclipse, eclipseMoment } from '../eclipses/lunar';
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

export interface TimelineView {
  readonly year: AstronomicalYear;
  readonly eclipses: readonly LunarEclipse[] | 'loading' | { readonly error: string };
  readonly selected: LunarEclipse | undefined;
}

export interface Timeline {
  readonly root: HTMLElement;
  render(view: TimelineView): void;
}

export function createTimeline(handlers: {
  onYear(year: AstronomicalYear): void;
  onSelect(eclipse: LunarEclipse): void;
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
  const list = element('ul', { class: 'eclipse-list', 'aria-label': 'Lunar eclipses this year' });
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
      if (view.eclipses === 'loading') {
        list.replaceChildren(element('li', { class: 'eclipse-empty' }, 'Loading…'));
        return;
      }
      if ('error' in view.eclipses) {
        list.replaceChildren(element('li', { class: 'eclipse-empty' }, view.eclipses.error));
        return;
      }
      if (view.eclipses.length === 0) {
        list.replaceChildren(
          element('li', { class: 'eclipse-empty' }, 'No lunar eclipses this year'),
        );
        return;
      }
      list.replaceChildren(
        ...view.eclipses.map((eclipse) => {
          const { date } = eclipseMoment(eclipse);
          const month = SHORT_MONTHS[date.month - 1] ?? '';
          const kind = describeLunarEclipse(eclipse).title.split(' ')[0] ?? '';
          const chip = element(
            'button',
            {
              type: 'button',
              class: `eclipse-chip kind-${eclipse.kind}`,
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
