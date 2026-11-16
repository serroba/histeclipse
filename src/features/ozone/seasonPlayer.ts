/**
 * The ozone season's own player (#804), in the panel beside the globe: the days from 1 July to
 * 31 December as a slider, and a button that plays them, a day at each step, so the hole is
 * seen to open and close. Outside a season, in a year that has one, a button leads into it.
 */

import { element } from '../../ui/dom';

/** A year's season, and where the view is in it. */
export interface SeasonView {
  readonly year: number;
  /** How many days after the season's first the view is; null on a date outside it. */
  readonly day: number | null;
  readonly days: number;
  /** The day shown as written, "25 September 2006"; the season's span when outside it. */
  readonly label: string;
  /** Go to a day of the season. */
  go(day: number): void;
}

/** How long each day is shown while the season plays, ms. */
export const DAY_MS = 140;
/** Where the button into a season leads: 1 October, 92 days after 1 July. */
const INTO_DAY = 92;

export interface SeasonPlayer {
  readonly root: HTMLElement;
  /** Show a season; null takes the player away and stops it. */
  update(view: SeasonView | null): void;
}

export function seasonPlayer(): SeasonPlayer {
  const into = element('button', { type: 'button', class: 'ozone-into' });
  const play = element('button', { type: 'button', class: 'ozone-play' }, 'Play the season');
  const slider = element('input', {
    type: 'range',
    min: '0',
    step: '1',
    class: 'ozone-days',
    'aria-label': 'Day of the season',
  });
  const label = element('output', { class: 'ozone-day' });
  const controls = element('div', { class: 'ozone-season-controls' }, play, slider, label);
  const root = element('div', { class: 'ozone-season', hidden: '' }, into, controls);
  let shown: SeasonView | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  function stop(): void {
    if (timer !== null) clearInterval(timer);
    timer = null;
    play.textContent = 'Play the season';
    play.setAttribute('aria-pressed', 'false');
  }

  function step(): void {
    const day = shown?.day ?? null;
    if (shown === null || day === null || day >= shown.days - 1) {
      stop();
      return;
    }
    shown.go(day + 1);
  }

  play.addEventListener('click', () => {
    if (timer !== null) {
      stop();
      return;
    }
    if (shown === null) return;
    // From its last day, play starts at the first.
    if (shown.day === null || shown.day >= shown.days - 1) shown.go(0);
    timer = setInterval(step, DAY_MS);
    play.textContent = 'Pause';
    play.setAttribute('aria-pressed', 'true');
  });
  slider.addEventListener('input', () => {
    stop();
    shown?.go(Number(slider.value));
  });
  into.addEventListener('click', () => {
    shown?.go(Math.min(INTO_DAY, (shown.days || 1) - 1));
  });

  return {
    root,
    update(view) {
      // Another year, or out of the season: play stops.
      const inSeason = (view?.day ?? null) !== null;
      if (!inSeason || view?.year !== shown?.year) stop();
      shown = view;
      root.hidden = view === null;
      if (view === null) return;
      const inside = view.day !== null;
      into.hidden = inside;
      controls.hidden = !inside;
      into.textContent = `The layer in 3D, day by day: ${view.label}`;
      slider.max = String(view.days - 1);
      slider.value = String(view.day ?? 0);
      label.textContent = inside ? view.label : '';
    },
  };
}
