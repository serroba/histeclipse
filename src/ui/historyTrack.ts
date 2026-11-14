/**
 * The Holocene's time bar, its upper half: Play, a slider over the years the date view reaches
 * with the Holocene's ages beneath, and what changed; while travelling, a way back to today's
 * Earth. Beside the date go the speed and, folded behind ⓘ, what the travel view shows and why.
 *
 * DOM glue, covered by the Playwright suite; `changesText` is unit-tested.
 */

import { astronomicalYear, formatYear } from '../time/year';
import type { Coastline } from '../deepTime/coastline';
import { YEAR_SPEEDS, type YearSpeed } from '../time/yearPlay';
import { element } from './dom';
import './historyTrack.css';

interface HistoryView {
  /** Astronomical years: the one shown, and the track's ends. */
  readonly year: number;
  readonly first: number;
  readonly last: number;
  readonly playing: boolean;
  /** Whether the travel view is on: even light, states and ways of life, the year's ice. */
  readonly travelling: boolean;
  readonly speed: YearSpeed;
  /** What the track says about states; a hint when the layer is off. */
  readonly changes: string;
  /** Why land may have no state drawn on it; null with the states off. */
  readonly blank: string | null;
  /** The sea level and ice of the year; null until the maps are in. */
  readonly earth: string | null;
}

export interface HistoryTrack {
  readonly root: HTMLElement;
  /** The speed picker and ⓘ, for the year bar's row beside the date. */
  readonly extras: HTMLElement;
  render(view: HistoryView): void;
}

/** How many names of each kind are spelled out before "and N more". */
const NAMED = 3;

function names(list: readonly string[]): string {
  const shown = list.slice(0, NAMED).join(', ');
  const more = list.length - NAMED;
  return more > 0 ? `${shown} and ${String(more)} more` : shown;
}

/** What changed by `year` (astronomical); null when nothing did. */
export function changesText(
  year: number,
  appeared: readonly string[],
  gone: readonly string[],
): string | null {
  if (appeared.length === 0 && gone.length === 0) return null;
  const parts = [
    ...(appeared.length > 0 ? [`new ${names(appeared)}`] : []),
    ...(gone.length > 0 ? [`gone ${names(gone)}`] : []),
  ];
  return `By ${formatYear(astronomicalYear(year))}: ${parts.join(' · ')}`;
}

export const STATES_HINT = 'Turn on States and empires in Layers to watch them come and go.';

/**
 * What the Layers panel says while travelling (#665): the travel view draws the year's ice and
 * sea itself, so turning every layer off leaves them.
 */
export const TRAVEL_ADDS =
  'Travel view draws the year’s ice and sea level itself, whatever layers are on. Travel view ✕ takes them away.';

/** What the track says while travelling, before any state has come or gone. */
export const STATES_WAIT = 'States that appear and go show here as the years go by.';

/** The sea level of the year against today's, by its source, and where the ice comes from. */
export function earthText(coastline: Coastline): string {
  const metres = Math.round(coastline.seaLevel);
  const level =
    metres === 0
      ? 'about today’s'
      : `${String(Math.abs(metres))} m ${metres < 0 ? 'below' : 'above'} today’s`;
  const instead =
    coastline.instead === null ? '' : `, as ${coastline.instead.label} does not reach`;
  return `Sea level ${level} (${coastline.series.label}${instead}); shelf it left bare is tinted sand. White: ice of the year where today has none (PaleoMIST, Gowan et al. 2021); today’s glaciers are in the photo.`;
}

/** Why land may have no state on it: the sources draw states, not every people. */
export function blankText(ways: boolean): string {
  const lived = ways
    ? 'the faint shading is how people lived there (ArchaeoGLOBE).'
    : 'turn on Ways of life to see how people lived there.';
  return `Land with no state drawn was not empty: these sources map states, not every people; ${lived}`;
}

export function createHistoryTrack(
  handlers: {
    onYear(year: number): void;
    onPlay(play: boolean): void;
    onSpeed(speed: YearSpeed): void;
    /** Leave the travel view for today's Earth, day and night. */
    onEndTravel(): void;
  },
  /** The ages along the slider, as deep time draws its periods. */
  bands: HTMLElement,
  /** Drawn under the ages, lined up with the slider: carbon-14 in the air, when on. */
  strip?: HTMLElement,
): HistoryTrack {
  const play = element(
    'button',
    { type: 'button', class: 'step history-play', 'aria-label': 'Travel through the years' },
    '▶',
  );
  const slider = element('input', {
    type: 'range',
    class: 'history-slider',
    step: '1',
    'aria-label': 'Year in the Holocene',
  });
  const speed = element(
    'select',
    { class: 'history-speed', 'aria-label': 'Speed' },
    ...YEAR_SPEEDS.map((each) =>
      element('option', { value: String(each) }, `${each.toLocaleString('en')} yr/s`),
    ),
  );
  const changes = element('p', { class: 'history-changes', 'data-testid': 'history-changes' });
  const blank = element('p', { class: 'history-blank', 'data-testid': 'history-blank' });
  const earth = element('p', { class: 'history-blank', 'data-testid': 'history-earth' });
  // What the travel view shows, and why: there when wanted, folded away otherwise.
  const about = element(
    'details',
    { class: 'history-about' },
    element('summary', { 'aria-label': 'About this view' }, 'ⓘ'),
    blank,
    earth,
  );
  const travel = element(
    'button',
    {
      type: 'button',
      class: 'travel-chip',
      'aria-label': 'Leave the travel view',
      title: 'Back to today’s Earth, with day and night',
      hidden: '',
    },
    'Travel view ✕',
  );
  travel.addEventListener('click', () => {
    handlers.onEndTravel();
  });
  const notes = element('div', { class: 'history-notes' }, changes, travel);
  const extras = element('span', { class: 'history-extras' }, speed, about);
  const root = element(
    'div',
    { class: 'history-track', role: 'group', 'aria-label': 'Holocene', id: 'history-track' },
    element(
      'div',
      { class: 'history-controls' },
      play,
      element(
        'div',
        { class: 'history-lane' },
        slider,
        bands,
        ...(strip === undefined ? [] : [strip]),
      ),
    ),
    notes,
  );
  let playing = false;
  play.addEventListener('click', () => {
    handlers.onPlay(!playing);
  });
  slider.addEventListener('input', () => {
    handlers.onYear(Number(slider.value));
  });
  speed.addEventListener('change', () => {
    const picked = YEAR_SPEEDS.find((each) => String(each) === speed.value);
    if (picked !== undefined) handlers.onSpeed(picked);
  });
  return {
    root,
    extras,
    render(view) {
      playing = view.playing;
      play.textContent = view.playing ? '❚❚' : '▶';
      play.setAttribute(
        'aria-label',
        view.playing ? 'Stop travelling' : 'Travel through the years',
      );
      slider.min = String(view.first);
      slider.max = String(view.last);
      if (document.activeElement !== slider) slider.value = String(view.year);
      slider.setAttribute('aria-valuetext', formatYear(astronomicalYear(view.year)));
      speed.value = String(view.speed);
      changes.textContent = view.changes;
      changes.hidden = view.changes === '';
      travel.hidden = !view.travelling;
      // The row goes when it has nothing to say, so the bar is no taller than it needs.
      notes.hidden = changes.hidden && travel.hidden;
      blank.hidden = view.blank === null;
      blank.textContent = view.blank ?? '';
      earth.hidden = view.earth === null;
      earth.textContent = view.earth ?? '';
      about.hidden = view.blank === null && view.earth === null;
    },
  };
}
