/**
 * The bottom bar: step or type a year, and pick one of that year's eclipses.
 * Mobile first: 44 px tap targets, a horizontally scrolling eclipse list, safe-area padding.
 */

import type { LunarEclipse } from '../data/lunarCatalog';
import type { SolarEclipse } from '../data/solarCatalog';
import { eclipseMoment, isSolar } from '../eclipses/describe';
import { astronomicalYear, toHistoricalYear, type AstronomicalYear, type Era } from '../time/year';
import { parseYearNumber } from '../time/yearInput';
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

const HINT = 'Type a year as a number, and pick BCE or CE beside it';

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
  // Digits only (a numeric keypad on phones); the era is picked beside it.
  const input = element('input', {
    id: 'year-input',
    class: 'year-input',
    type: 'text',
    inputmode: 'numeric',
    pattern: '[0-9]*',
    maxlength: '5',
    autocomplete: 'off',
    enterkeyhint: 'go',
    spellcheck: 'false',
    'aria-describedby': 'year-hint',
  });
  const era = element(
    'select',
    { class: 'era-select', 'aria-label': 'Era' },
    element('option', { value: 'BCE' }, 'BCE'),
    element('option', { value: 'CE' }, 'CE'),
  );
  const hint = element('span', { id: 'year-hint', class: 'visually-hidden' }, HINT);
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
    era,
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
  // Anything but digits never makes it into the box, pasted or typed.
  input.addEventListener('input', () => {
    const digits = input.value.replaceAll(/\D/g, '').slice(0, 5);
    if (digits !== input.value) input.value = digits;
  });
  function submit(): void {
    try {
      const typed = parseYearNumber(input.value, era.value === 'BCE' ? 'BCE' : 'CE');
      input.removeAttribute('aria-invalid');
      input.blur();
      handlers.onYear(typed);
    } catch (error) {
      input.setAttribute('aria-invalid', 'true');
      hint.textContent = errorMessage(error);
    }
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit();
  });
  // Switching the era keeps the number: 587 CE becomes 587 BCE.
  era.addEventListener('change', submit);

  return {
    root,
    render(view) {
      year = view.year;
      const shown = toHistoricalYear(view.year);
      if (document.activeElement !== input) input.value = String(shown.year);
      era.value = shown.era satisfies Era;
      hint.textContent = HINT;
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
