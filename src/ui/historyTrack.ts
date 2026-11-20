/**
 * The Holocene's time bar, its upper half: Play, a slider over the years the date view reaches
 * with the Holocene's ages beneath, and what changed; while travelling, a way back to today's
 * Earth. Beside the date go the speed and, folded behind ⓘ, what the travel view shows and why.
 *
 * DOM glue, covered by the Playwright suite; `changesText` is unit-tested.
 */

import { astronomicalYear, formatYear } from '../time/year';
import type { Coastline } from '../deepTime/coastline';
import { SPEED_LEVELS, type PlaySpeed, type SpeedLevel } from '../time/playSpeeds';
import { element } from './dom';
import { createTransport } from './transport';
import './historyTrack.css';

interface HistoryView {
  /** Astronomical years: the one shown, and the track's ends. */
  readonly year: number;
  readonly first: number;
  readonly last: number;
  readonly playing: boolean;
  /** Whether the travel view is on: even light, states and ways of life, the year's ice. */
  readonly travelling: boolean;
  /** The speeds offered for the years shown (#915), and the level picked. */
  readonly speeds: readonly PlaySpeed[];
  readonly speed: SpeedLevel;
  /** The windows of years offered (#749), and the one shown, as their values. */
  readonly windows: readonly { readonly value: string; readonly label: string }[];
  readonly window: string;
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

/** What the track's notes say, by what is on and what has happened. */
export interface NoteFacts {
  /** States and empires on, and what they last said changed ('' for nothing yet). */
  readonly empires: boolean;
  readonly said: string;
  readonly travelling: boolean;
  /** Whether the travel view brings layers in (not with a subject of its own, as El Niño). */
  readonly brings: boolean;
  /** Play went back to the start of the years shown (#982): from where, to where, and today. */
  readonly from: { readonly first: number; readonly last: number; readonly present: number } | null;
}

/**
 * The line under the track: what changed, once states have; until then, after Play went back to
 * the start, where it is playing from and to, so the jump of thousands of years is not a
 * surprise (#982); else what to expect while travelling, or nothing.
 */
export function trackNote({ empires, said, travelling, brings, from }: NoteFacts): string {
  if (empires && said !== '') return said;
  if (from !== null) {
    const to = from.last >= from.present ? 'today' : formatYear(astronomicalYear(from.last));
    return `From ${formatYear(astronomicalYear(from.first))} to ${to}`;
  }
  if (empires) return travelling ? STATES_WAIT : '';
  return travelling && brings ? STATES_HINT : '';
}

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
    onSpeed(speed: SpeedLevel): void;
    /** Leave the travel view for today's Earth, day and night. */
    onEndTravel(): void;
    /** A window of years picked, by its value. */
    onWindow(value: string): void;
  },
  /** The ages along the slider, as deep time draws its periods. */
  bands: HTMLElement,
  /** Drawn under the ages, lined up with the slider: carbon-14 in the air, when on. */
  strip?: HTMLElement,
): HistoryTrack {
  // Space travels or stops and the arrows step a year, as on all that plays (`transport.ts`).
  const transport = createTransport(
    {
      play: {
        className: 'step history-play',
        words: { play: 'Travel through the years', pause: 'Stop travelling' },
      },
      slider: { class: 'history-slider', step: '1', 'aria-label': 'Year in the Holocene' },
    },
    {
      onPlay(play) {
        handlers.onPlay(play);
      },
      onSlide(year) {
        handlers.onYear(year);
      },
    },
  );
  const { play, slider } = transport;
  const speed = element('select', { class: 'history-speed', 'aria-label': 'Speed' });
  let speedsListed = '';
  const range = element('select', { class: 'history-range', 'aria-label': 'Years shown' });
  range.addEventListener('change', () => {
    handlers.onWindow(range.value);
  });
  let rangeListed = '';
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
  // The ⓘ goes with the travel view's notes and chip, so it never takes a row of its own on a
  // phone, where the years shown and the speed fill theirs (#985).
  const notes = element('div', { class: 'history-notes' }, changes, about, travel);
  const extras = element('span', { class: 'history-extras' }, range, speed);
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
  transport.join(root);
  speed.addEventListener('change', () => {
    const picked = SPEED_LEVELS.find((each) => each === speed.value);
    if (picked !== undefined) handlers.onSpeed(picked);
  });
  return {
    root,
    extras,
    render(view) {
      slider.min = String(view.first);
      slider.max = String(view.last);
      transport.render(view.playing, view.year);
      slider.setAttribute('aria-valuetext', formatYear(astronomicalYear(view.year)));
      const speedsShown = view.speeds.map(({ level, label }) => `${level}=${label}`).join('|');
      if (speedsShown !== speedsListed) {
        speedsListed = speedsShown;
        speed.replaceChildren(
          ...view.speeds.map(({ level, label }) => element('option', { value: level }, label)),
        );
      }
      speed.value = view.speed;
      const listed = view.windows.map(({ value, label }) => `${value}=${label}`).join('|');
      if (listed !== rangeListed) {
        rangeListed = listed;
        range.replaceChildren(
          ...view.windows.map(({ value, label }) => element('option', { value }, label)),
        );
      }
      range.value = view.window;
      changes.textContent = view.changes;
      changes.hidden = view.changes === '';
      travel.hidden = !view.travelling;
      blank.hidden = view.blank === null;
      blank.textContent = view.blank ?? '';
      earth.hidden = view.earth === null;
      earth.textContent = view.earth ?? '';
      about.hidden = view.blank === null && view.earth === null;
      // The row goes when it has nothing to say, so the bar is no taller than it needs.
      notes.hidden = changes.hidden && travel.hidden && about.hidden;
    },
  };
}
