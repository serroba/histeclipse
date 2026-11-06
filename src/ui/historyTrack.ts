/**
 * The Holocene track: Play, a slider over the years the date view reaches, and the speed, above
 * the year bar; and, with the states layer on, which states came and went.
 *
 * DOM glue, covered by the Playwright suite; `changesText` is unit-tested.
 */

import { astronomicalYear, formatYear } from '../time/year';
import type { Coastline } from '../deepTime/coastline';
import { YEAR_SPEEDS, type YearSpeed } from '../time/yearPlay';
import { element } from './dom';

export interface HistoryView {
  /** Astronomical years: the one shown, and the track's ends. */
  readonly year: number;
  readonly first: number;
  readonly last: number;
  readonly playing: boolean;
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
  /** The button in the year bar that opens the track. */
  readonly button: HTMLButtonElement;
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

/** The sea level of the year against today's, by its source, and where the ice comes from. */
export function earthText(coastline: Coastline): string {
  const metres = Math.round(coastline.seaLevel);
  const level =
    metres === 0
      ? 'about today’s'
      : `${String(Math.abs(metres))} m ${metres < 0 ? 'below' : 'above'} today’s`;
  const instead =
    coastline.instead === null ? '' : `, as ${coastline.instead.label} does not reach`;
  return `Sea level ${level} (${coastline.series.label}${instead}); shelf it left bare is tinted sand. Ice sheets: PaleoMIST (Gowan et al. 2021).`;
}

/** Why land may have no state on it: the sources draw states, not every people. */
export function blankText(ways: boolean): string {
  const lived = ways
    ? 'the faint shading is how people lived there (ArchaeoGLOBE).'
    : 'turn on Ways of life to see how people lived there.';
  return `Land with no state drawn was not empty: these sources map states, not every people; ${lived}`;
}

export function createHistoryTrack(handlers: {
  onYear(year: number): void;
  onPlay(play: boolean): void;
  onSpeed(speed: YearSpeed): void;
  /** The track opened or closed. */
  onOpen(open: boolean): void;
}): HistoryTrack {
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
      element('option', { value: String(each) }, `${each.toLocaleString('en')} years/s`),
    ),
  );
  const changes = element('p', { class: 'history-changes', 'data-testid': 'history-changes' });
  const blank = element('p', { class: 'history-blank', 'data-testid': 'history-blank' });
  const earth = element('p', { class: 'history-blank', 'data-testid': 'history-earth' });
  const close = element(
    'button',
    { type: 'button', class: 'step history-close', 'aria-label': 'Close the track' },
    '×',
  );
  const root = element(
    'div',
    {
      class: 'history-track',
      role: 'group',
      'aria-label': 'Holocene',
      id: 'history-track',
      hidden: '',
    },
    element('div', { class: 'history-controls' }, play, slider, speed, close),
    changes,
    blank,
    earth,
  );
  // Folded away until asked for, so the globe keeps its room.
  const button = element(
    'button',
    {
      type: 'button',
      class: 'famous-open history-open',
      'aria-expanded': 'false',
      'aria-controls': 'history-track',
    },
    'Travel',
  );
  function setOpen(open: boolean): void {
    root.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (!open && playing) handlers.onPlay(false);
    handlers.onOpen(open);
  }
  button.addEventListener('click', () => {
    setOpen(button.getAttribute('aria-expanded') !== 'true');
  });
  close.addEventListener('click', () => {
    setOpen(false);
    button.focus();
  });
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
    button,
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
      blank.hidden = view.blank === null;
      blank.textContent = view.blank ?? '';
      earth.hidden = view.earth === null;
      earth.textContent = view.earth ?? '';
    },
  };
}
