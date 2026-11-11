/**
 * Away from Earth, the bottom bar's time is the body's own cycle as Earth sees it (#329): Play,
 * a slider over the days from one conjunction to the next (or, for the Sun, perihelion to
 * perihelion), ticks where the cycle turns, and those moments named beneath, each a tap away.
 * Beside the date goes the speed: hours a second, to watch moons go round (#335), or days.
 *
 * DOM glue, covered by the Playwright suite; the cycle is worked out in `astro/planetCycle.ts`.
 */

import type { CycleMark } from '../astro/planetCycle';
import { element } from './dom';
import './historyTrack.css';
import './cycleTrack.css';

/** Hours a second the cycle can play at: an hour or six for the moons, a day or more for the
 * planets. */
export const CYCLE_SPEEDS = [1, 6, 24, 120, 240, 720] as const;
export type CycleSpeed = (typeof CYCLE_SPEEDS)[number];

/** Each moment's words, and what it means. */
export const MARK_WORDS: Readonly<Record<CycleMark, readonly [string, string]>> = {
  behind: ['Behind the Sun', 'Conjunction: beyond the Sun, lost in its glare'],
  opposite: ['Opposite the Sun', 'Opposition: near its closest and brightest, up all night'],
  between: ['Between us and the Sun', 'Inferior conjunction: closest, its dark side towards us'],
  evening: ['Best in the evening', 'Greatest elongation east of the Sun: highest after sunset'],
  morning: ['Best in the morning', 'Greatest elongation west of the Sun: highest before sunrise'],
  perihelion: ['Earth nearest the Sun', 'Perihelion: the Sun looks its largest'],
  aphelion: ['Earth farthest from the Sun', 'Aphelion: the Sun looks its smallest'],
};

/** A speed as written: "6 hours/s", "1 day/s", "10 days/s". */
export function speedWords(hours: CycleSpeed): string {
  if (hours < 24) return `${String(hours)} ${hours === 1 ? 'hour' : 'hours'}/s`;
  const days = hours / 24;
  return `${String(days)} ${days === 1 ? 'day' : 'days'}/s`;
}

export interface CycleMoment {
  readonly mark: CycleMark;
  /** UT Julian Day, and its date as written. */
  readonly jd: number;
  readonly date: string;
}

export interface CycleView {
  /** What the bar runs over, as in "Mars’s cycle, as seen from Earth", and its slider's name. */
  readonly title: string;
  readonly slider: string;
  /** UT Julian Days: the moment shown, between the cycle's first and last moments. */
  readonly jd: number;
  readonly moments: readonly CycleMoment[];
  readonly playing: boolean;
  readonly speed: CycleSpeed;
}

export interface CycleTrack {
  readonly root: HTMLElement;
  /** The speed picker, for the year bar's row beside the date. */
  readonly extras: HTMLElement;
  /** The body's cycle; null on Earth and the Moon, whose bar is the years'. */
  render(view: CycleView | null): void;
}

export function createCycleTrack(handlers: {
  onDay(jd: number): void;
  onPlay(play: boolean): void;
  onSpeed(speed: CycleSpeed): void;
}): CycleTrack {
  const play = element(
    'button',
    { type: 'button', class: 'step history-play', 'aria-label': 'Play the cycle' },
    '▶',
  );
  const slider = element('input', { type: 'range', class: 'history-slider', step: 'any' });
  const ticks = element('div', { class: 'cycle-ticks', 'aria-hidden': 'true' });
  const moments = element('ol', { class: 'cycle-moments' });
  const speed = element(
    'select',
    { class: 'history-speed', 'aria-label': 'Time a second' },
    ...CYCLE_SPEEDS.map((each) => element('option', { value: String(each) }, speedWords(each))),
  );
  const extras = element('span', { class: 'history-extras', hidden: '' }, speed);
  const root = element(
    'div',
    { class: 'history-track cycle-track', role: 'group', hidden: '' },
    element(
      'div',
      { class: 'history-controls' },
      play,
      element('div', { class: 'history-lane' }, slider, ticks),
    ),
    moments,
  );
  let playing = false;
  play.addEventListener('click', () => {
    handlers.onPlay(!playing);
  });
  slider.addEventListener('input', () => {
    handlers.onDay(Number(slider.value));
  });
  speed.addEventListener('change', () => {
    const picked = CYCLE_SPEEDS.find((each) => String(each) === speed.value);
    if (picked !== undefined) handlers.onSpeed(picked);
  });
  // Drawn again only when the cycle changes, not each frame as it plays.
  let drawn: readonly CycleMoment[] | null = null;
  let buttons: readonly HTMLButtonElement[] = [];
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
      const first = view.moments[0]?.jd ?? view.jd;
      const last = view.moments.at(-1)?.jd ?? view.jd;
      if (view.moments !== drawn) {
        drawn = view.moments;
        root.setAttribute('aria-label', view.title);
        slider.setAttribute('aria-label', view.slider);
        slider.min = String(first);
        slider.max = String(last);
        ticks.replaceChildren(
          ...view.moments.map(({ jd }) =>
            element('span', {
              class: 'cycle-tick',
              style: `left: ${String((100 * (jd - first)) / (last - first))}%`,
            }),
          ),
        );
        buttons = view.moments.map(({ mark, jd, date }) => {
          const [words, meaning] = MARK_WORDS[mark];
          const button = element(
            'button',
            { type: 'button', class: 'cycle-moment', title: meaning },
            element('span', { class: 'cycle-moment-name' }, words),
            ' ',
            element('span', { class: 'cycle-moment-date' }, date),
          );
          button.addEventListener('click', () => {
            handlers.onDay(jd);
          });
          return button;
        });
        moments.replaceChildren(...buttons.map((button) => element('li', {}, button)));
      }
      playing = view.playing;
      play.textContent = view.playing ? '❚❚' : '▶';
      play.setAttribute('aria-label', view.playing ? 'Stop the cycle' : 'Play the cycle');
      if (document.activeElement !== slider) slider.value = String(view.jd);
      // The moment last passed is the one the bar is at (a minute either way: times are kept to
      // the minute).
      let at = 0;
      view.moments.forEach(({ jd }, index) => {
        if (jd <= view.jd + 1 / 1440) at = index;
      });
      buttons.forEach((button, index) => {
        if (index === at) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      });
      slider.setAttribute(
        'aria-valuetext',
        `${String(Math.round(view.jd - first))} days after ${MARK_WORDS[view.moments[0]?.mark ?? 'behind'][0].toLowerCase()}`,
      );
      speed.value = String(view.speed);
    },
  };
}
