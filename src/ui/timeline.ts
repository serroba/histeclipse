/**
 * The bottom bar: step or type a year, and pick one of that year's eclipses.
 * Mobile first: 44 px tap targets, a horizontally scrolling eclipse list, safe-area padding.
 */

import type { LunarEclipse } from '../data/lunarCatalog';
import type { SolarEclipse } from '../data/solarCatalog';
import { isSolar } from '../eclipses/describe';
import type { SeenIn } from '../eclipses/seenIn';
import { greatestEclipseUT } from '../data/catalog';
import { CALENDAR_INFO, shortDate, YEAR_CALENDARS, type YearCalendar } from '../time/calendars';
import { astronomicalYear, toHistoricalYear } from '../time/year';
import { parseYearNumber } from '../time/yearInput';
import { errorMessage } from '../util/errors';
import { element } from './dom';

const HINT = 'Type a year as a number, and pick its era or calendar beside it';

export type Eclipse = LunarEclipse | SolarEclipse;

export type YearEclipses =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly eclipses: readonly Eclipse[] }
  | { readonly status: 'error'; readonly message: string };

/** Which eclipses could be seen from a past state picked in the bar. */
export type SeenView =
  | { readonly status: 'off' }
  | { readonly status: 'loading'; readonly name: string }
  | { readonly status: 'absent'; readonly name: string }
  | { readonly status: 'searching'; readonly name: string }
  | {
      readonly status: 'ready';
      readonly name: string;
      readonly marks: ReadonlyMap<Eclipse, SeenIn>;
    };

export interface SeenControls {
  /** Whether to offer the picker: with the empires layer on, or a state already picked. */
  readonly shown: boolean;
  /** States on the map in the year shown, to pick from. */
  readonly options: readonly string[];
  readonly view: SeenView;
}

const SEEN_WORDS: Record<SeenIn['phase'], string> = {
  total: 'total',
  annular: 'annular',
  partial: 'partial',
  penumbral: 'penumbral',
  none: 'not seen',
};

/** What a chip says about how an eclipse looked from the state picked. */
export function seenLabel(seen: SeenIn): string {
  if (seen.verdict === 'not') return 'not seen';
  if (seen.verdict === 'maybe') return 'maybe seen (ΔT)';
  return `seen, ${SEEN_WORDS[seen.phase]}`;
}

export interface TimelineView {
  /** The year in `calendar`; western years are astronomical (0 is 1 BCE). */
  readonly year: number;
  readonly calendar: YearCalendar;
  readonly eclipses: YearEclipses;
  readonly selected: Eclipse | undefined;
  readonly seen: SeenControls;
}

export interface Timeline {
  readonly root: HTMLElement;
  render(view: TimelineView): void;
}

export function createTimeline(handlers: {
  /** A year in the calendar shown. */
  onYear(year: number): void;
  /** Count years in another calendar, keeping the moment. */
  onCalendar(calendar: YearCalendar): void;
  onSelect(eclipse: Eclipse): void;
  /** Pick a past state whose eclipses to mark, or null for anywhere. */
  onSeenIn(name: string | null): void;
  /** Go to the previous or next eclipse seen from that state. */
  onSeenStep(direction: 1 | -1): void;
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
  // One list for the era: BCE and CE, or another calendar's own count.
  const era = element(
    'select',
    { class: 'era-select', 'aria-label': 'Era' },
    element('option', { value: 'BCE' }, 'BCE'),
    element('option', { value: 'CE' }, 'CE'),
    element(
      'optgroup',
      { label: 'Other calendars' },
      ...YEAR_CALENDARS.filter((calendar) => calendar !== 'western').map((calendar) =>
        element(
          'option',
          { value: calendar },
          `${CALENDAR_INFO[calendar].era} · ${CALENDAR_INFO[calendar].name}`,
        ),
      ),
    ),
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
  const ANYWHERE = '';
  const seenSelect = element('select', {
    id: 'seen-select',
    class: 'seen-select',
    'data-testid': 'seen-select',
  });
  const seenPrevious = element(
    'button',
    { type: 'button', class: 'step seen-step', 'aria-label': 'Previous eclipse seen from there' },
    '‹',
  );
  const seenNext = element(
    'button',
    { type: 'button', class: 'step seen-step', 'aria-label': 'Next eclipse seen from there' },
    '›',
  );
  const seenStatus = element('span', {
    class: 'seen-status',
    role: 'status',
    'data-testid': 'seen-status',
  });
  const seenRow = element(
    'div',
    { class: 'seen-controls', hidden: '' },
    element('label', { for: 'seen-select', class: 'seen-label' }, 'Seen from'),
    seenSelect,
    seenPrevious,
    seenNext,
    seenStatus,
  );
  const root = element(
    'nav',
    { class: 'timeline', 'aria-label': 'Year and eclipses' },
    element('div', { class: 'year-controls' }, previous, form, next),
    list,
    seenRow,
  );
  seenSelect.addEventListener('change', () => {
    handlers.onSeenIn(seenSelect.value === ANYWHERE ? null : seenSelect.value);
  });
  seenPrevious.addEventListener('click', () => {
    handlers.onSeenStep(-1);
  });
  seenNext.addEventListener('click', () => {
    handlers.onSeenStep(1);
  });

  function renderSeen(seen: SeenControls): void {
    seenRow.hidden = !seen.shown;
    const picked = seen.view.status === 'off' ? null : seen.view.name;
    const names = [...seen.options];
    // A state picked in another year stays in the list, even where it is not on the map.
    if (picked !== null && !names.includes(picked)) names.unshift(picked);
    const wanted = [ANYWHERE, ...names].join('\n');
    if (seenSelect.dataset['options'] !== wanted) {
      seenSelect.dataset['options'] = wanted;
      seenSelect.replaceChildren(
        element('option', { value: ANYWHERE }, 'Anywhere'),
        ...names.map((name) => element('option', { value: name }, name)),
      );
    }
    seenSelect.value = picked ?? ANYWHERE;
    seenPrevious.disabled = picked === null;
    seenNext.disabled = picked === null;
    const view = seen.view;
    if (view.status === 'off') seenStatus.textContent = '';
    else if (view.status === 'loading') seenStatus.textContent = 'Working out what was seen…';
    else if (view.status === 'searching') seenStatus.textContent = 'Searching…';
    else if (view.status === 'absent') seenStatus.textContent = 'Not on the map this year';
    else {
      const count = [...view.marks.values()].filter((mark) => mark.verdict !== 'not').length;
      seenStatus.textContent = `${String(count)} of ${String(view.marks.size)} seen`;
    }
  }

  let year = 2000;
  let calendar: YearCalendar = 'western';
  previous.addEventListener('click', () => {
    handlers.onYear(year - 1);
  });
  next.addEventListener('click', () => {
    handlers.onYear(year + 1);
  });
  // Anything but digits never makes it into the box, pasted or typed.
  input.addEventListener('input', () => {
    const digits = input.value.replaceAll(/\D/g, '').slice(0, 5);
    if (digits !== input.value) input.value = digits;
  });
  function submit(): void {
    try {
      // Other calendars count from 1 with no era to pick, like CE.
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
  era.addEventListener('change', () => {
    const picked = era.value;
    const other = YEAR_CALENDARS.find((option) => option !== 'western' && option === picked);
    if (other !== undefined) {
      handlers.onCalendar(other);
    } else if (calendar !== 'western') {
      handlers.onCalendar('western');
    } else {
      // Switching BCE and CE keeps the number: 587 CE becomes 587 BCE.
      submit();
    }
  });

  return {
    root,
    render(view) {
      year = view.year;
      calendar = view.calendar;
      if (calendar === 'western') {
        const shown = toHistoricalYear(astronomicalYear(view.year));
        if (document.activeElement !== input) input.value = String(shown.year);
        era.value = shown.era;
      } else {
        if (document.activeElement !== input) input.value = String(view.year);
        era.value = calendar;
      }
      hint.textContent = HINT;
      renderSeen(view.seen);
      const marks = view.seen.view.status === 'ready' ? view.seen.view.marks : null;
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
          const body = isSolar(eclipse) ? 'solar' : 'lunar';
          const kind = `${eclipse.kind[0]?.toUpperCase() ?? ''}${eclipse.kind.slice(1)} ${body}`;
          const mark = marks?.get(eclipse);
          const chip = element(
            'button',
            {
              type: 'button',
              class: `eclipse-chip body-${body} kind-${eclipse.kind}${mark === undefined ? '' : ` seen-${mark.verdict}`}`,
              'aria-pressed': String(eclipse === view.selected),
            },
            element('span', { class: 'eclipse-dot', 'aria-hidden': 'true' }),
            element(
              'span',
              { class: 'eclipse-date' },
              shortDate(view.calendar, greatestEclipseUT(eclipse)),
            ),
            element('span', { class: 'eclipse-kind' }, kind),
          );
          if (mark !== undefined) {
            chip.append(element('span', { class: 'eclipse-seen' }, seenLabel(mark)));
          }
          chip.addEventListener('click', () => {
            handlers.onSelect(eclipse);
          });
          return element('li', {}, chip);
        }),
      );
    },
  };
}
