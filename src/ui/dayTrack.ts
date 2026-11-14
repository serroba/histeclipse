/**
 * Days to play in the bottom bar: Play, a slider over the days, ticks at the moments that
 * matter, and those moments named beneath, each a tap away; beside the date, the speed. Away
 * from Earth it runs over a body's cycle as Earth sees it (#329); with the spacecraft on, over
 * the launches from the first to today (#702).
 *
 * DOM glue, covered by the Playwright suite.
 */

import { element } from './dom';
import './historyTrack.css';
import './dayTrack.css';

/** A speed as written: "6 hours/s", "1 day/s", "10 days/s". */
function speedWords(hours: number): string {
  if (hours < 24) return `${String(hours)} ${hours === 1 ? 'hour' : 'hours'}/s`;
  const days = hours / 24;
  return `${String(days)} ${days === 1 ? 'day' : 'days'}/s`;
}

export interface DayMoment {
  /** What happened, and (as the chip's title) what it means. */
  readonly name: string;
  readonly meaning: string;
  /** UT Julian Day, and its date as written. */
  readonly jd: number;
  readonly date: string;
}

export interface DayView {
  /** What the bar runs over, as in "Mars’s cycle, as seen from Earth", and its slider's name. */
  readonly title: string;
  readonly slider: string;
  /** UT Julian Days: the moment shown, and the first and last days the slider reaches. */
  readonly jd: number;
  readonly first: number;
  readonly last: number;
  /** The moments named, in order: the same array until they change. */
  readonly moments: readonly DayMoment[];
  /** What the slider's days are counted from, as in "days after perihelion". */
  readonly since: string;
  readonly playing: boolean;
  /** Hours a second. */
  readonly speed: number;
  /** Hours a second it can play at, where they differ from the track's own: the same array
   * until they change. */
  readonly speeds?: readonly number[];
  /** Whether the button that leaves it shows. */
  readonly leave?: boolean;
}

export interface DayTrack {
  readonly root: HTMLElement;
  /** The speed picker, for the year bar's row beside the date. */
  readonly extras: HTMLElement;
  /** The days to play; null hides the track. */
  render(view: DayView | null): void;
}

export interface DayTrackOptions {
  /** The track's own class, beside `history-track`. */
  readonly className: string;
  /** Hours a second it can play at. */
  readonly speeds: readonly number[];
  /** The Play button's name, playing and not. */
  readonly play: string;
  readonly stop: string;
  /** The words on a button that leaves what plays, where it has one. */
  readonly leave?: string;
}

/** The speed picker's choices. */
function speedOptions(speeds: readonly number[]): HTMLOptionElement[] {
  return speeds.map((each) => element('option', { value: String(each) }, speedWords(each)));
}

/** The track's elements, before anything is drawn on them. */
function buildTrack(options: DayTrackOptions) {
  const play = element(
    'button',
    { type: 'button', class: 'step history-play', 'aria-label': options.play },
    '▶',
  );
  const slider = element('input', { type: 'range', class: 'history-slider', step: 'any' });
  const ticks = element('div', { class: 'cycle-ticks', 'aria-hidden': 'true' });
  const moments = element('ol', { class: 'cycle-moments' });
  const speed = element('select', { class: 'history-speed', 'aria-label': 'Time a second' });
  speed.replaceChildren(...speedOptions(options.speeds));
  const leave = element(
    'button',
    { type: 'button', class: 'day-leave', hidden: '' },
    options.leave ?? '',
  );
  const extras = element('span', { class: 'history-extras', hidden: '' }, speed);
  const root = element(
    'div',
    { class: `history-track ${options.className}`, role: 'group', hidden: '' },
    element(
      'div',
      { class: 'history-controls' },
      play,
      element('div', { class: 'history-lane' }, slider, ticks),
      leave,
    ),
    moments,
  );
  return { play, slider, ticks, moments, speed, extras, root, leave };
}

type TrackElements = ReturnType<typeof buildTrack>;

/** The moments' ticks along the slider and their chips beneath; the chips, to mark. */
function drawMoments(
  view: DayView,
  { root, slider, ticks, moments }: TrackElements,
  onDay: (jd: number) => void,
): readonly HTMLButtonElement[] {
  const { first, last } = view;
  root.setAttribute('aria-label', view.title);
  slider.setAttribute('aria-label', view.slider);
  slider.min = String(first);
  slider.max = String(last);
  ticks.replaceChildren(
    ...view.moments.map(({ jd }) => {
      // Through the style object: the CSP allows no style attribute.
      const tick = element('span', { class: 'cycle-tick' });
      tick.style.left = `${String((100 * (jd - first)) / (last - first))}%`;
      return tick;
    }),
  );
  const buttons = view.moments.map(({ name, meaning, jd, date }) => {
    const button = element(
      'button',
      { type: 'button', class: 'cycle-moment', title: meaning },
      element('span', { class: 'cycle-moment-name' }, name),
      ' ',
      element('span', { class: 'cycle-moment-date' }, date),
    );
    button.addEventListener('click', () => {
      onDay(jd);
    });
    return button;
  });
  moments.replaceChildren(...buttons.map((button) => element('li', {}, button)));
  return buttons;
}

/** The moment last passed (a minute either way: times are kept to the minute). */
function lastPassed(view: DayView): number {
  let at = 0;
  view.moments.forEach(({ jd }, index) => {
    if (jd <= view.jd + 1 / 1440) at = index;
  });
  return at;
}

export function createDayTrack(
  options: DayTrackOptions,
  handlers: {
    onDay(jd: number): void;
    onPlay(play: boolean): void;
    onSpeed(hours: number): void;
    onLeave?(): void;
  },
): DayTrack {
  const elements = buildTrack(options);
  const { play, slider, moments, speed, extras, root, leave } = elements;
  let speeds: readonly number[] = options.speeds;
  leave.addEventListener('click', () => {
    handlers.onLeave?.();
  });
  let playing = false;
  play.addEventListener('click', () => {
    handlers.onPlay(!playing);
  });
  slider.addEventListener('input', () => {
    handlers.onDay(Number(slider.value));
  });
  speed.addEventListener('change', () => {
    const picked = speeds.find((each) => String(each) === speed.value);
    if (picked !== undefined) handlers.onSpeed(picked);
  });
  // Drawn again only when the moments change, not each frame as it plays.
  let drawn: readonly DayMoment[] | null = null;
  let buttons: readonly HTMLButtonElement[] = [];
  let current = -1;

  /** The moment last passed is the current one, kept in view in its row. */
  function markCurrent(view: DayView): void {
    const at = lastPassed(view);
    if (at === current) return;
    buttons[current]?.removeAttribute('aria-current');
    current = at;
    const item = buttons[at]?.parentElement;
    buttons[at]?.setAttribute('aria-current', 'true');
    // Scrolled within the row only: the page itself stays where it is.
    if (item !== undefined && item !== null && root.hidden === false) {
      moments.scrollLeft = item.offsetLeft - moments.offsetLeft - 12;
    }
  }

  return {
    root,
    extras,
    render(view) {
      root.hidden = view === null;
      extras.hidden = view === null;
      if (view === null) {
        drawn = null;
        return;
      }
      if (view.moments !== drawn) {
        drawn = view.moments;
        current = -1;
        buttons = drawMoments(view, elements, (jd) => {
          handlers.onDay(jd);
        });
      }
      playing = view.playing;
      play.textContent = view.playing ? '❚❚' : '▶';
      play.setAttribute('aria-label', view.playing ? options.stop : options.play);
      if (document.activeElement !== slider) slider.value = String(view.jd);
      markCurrent(view);
      slider.setAttribute(
        'aria-valuetext',
        `${String(Math.round(view.jd - view.first))} days after ${view.since}`,
      );
      if (view.speeds !== undefined && view.speeds !== speeds) {
        speeds = view.speeds;
        speed.replaceChildren(...speedOptions(speeds));
      }
      speed.value = String(view.speed);
      leave.hidden = view.leave !== true;
    },
  };
}
