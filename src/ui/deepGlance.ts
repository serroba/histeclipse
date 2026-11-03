/**
 * Deep time at a glance, for full view: when it is, the period, and how far through the span,
 * with Play, on a strip along the bottom while the panels are cleared away. Its bar is a
 * slider: tap or drag it to any moment of the span. With the globe coloured by temperature, a
 * small scale says what the colours mean.
 *
 * DOM glue, covered by the Playwright suite.
 */

import { celsiusText, legendGradient, scaleTicks, TEMPERATURE_STOPS } from './deepTimeBar';
import { element } from './dom';

export interface DeepGlanceView {
  /** How long ago, in words, and the period. */
  readonly when: string;
  readonly period: string;
  /** Million years ago shown, and the span's oldest. */
  readonly ma: number;
  readonly oldest: number;
  readonly playing: boolean;
  /** Whether the globe is coloured by temperature. */
  readonly temperature: boolean;
}

export interface DeepGlance {
  readonly root: HTMLElement;
  /** Show the moment, or null outside deep time. */
  render(view: DeepGlanceView | null): void;
}

/** Slider steps across the span. */
const STEPS = 1000;

export function createDeepGlance(
  onPlay: (play: boolean) => void,
  onMa: (ma: number) => void,
): DeepGlance {
  const play = element(
    'button',
    { type: 'button', class: 'deep-glance-play', 'aria-label': 'Play' },
    '▶',
  );
  const when = element('strong', { class: 'deep-glance-when' });
  const period = element('span', { class: 'deep-glance-period' });
  const slider = element('input', {
    type: 'range',
    class: 'deep-glance-slider',
    min: '0',
    max: String(STEPS),
    step: '1',
    'aria-label': 'Time shown',
  });
  const scale = element('span', { class: 'deep-glance-scale', 'aria-hidden': 'true' });
  scale.style.background = legendGradient(TEMPERATURE_STOPS);
  const ticks = element(
    'span',
    { class: 'deep-glance-ticks', 'aria-hidden': 'true' },
    ...scaleTicks(TEMPERATURE_STOPS, [-40, 0, 15, 30, 45]).map(({ celsius, at }) => {
      const tick = element('span', {}, celsiusText(celsius));
      tick.style.left = `${(at * 100).toFixed(1)}%`;
      return tick;
    }),
  );
  const temperature = element(
    'div',
    {
      class: 'deep-glance-temperature',
      'data-testid': 'glance-temperature',
      role: 'img',
      'aria-label':
        'Temperature: blue −40 °C or colder, white about 5 °C, yellow 15 °C, red 45 °C or hotter',
      hidden: '',
    },
    scale,
    ticks,
  );
  const root = element(
    'div',
    { class: 'deep-glance', 'data-testid': 'deep-glance', hidden: '' },
    play,
    element(
      'div',
      { class: 'deep-glance-body' },
      element('p', {}, when, ' ', period),
      slider,
      temperature,
    ),
  );
  let playing = false;
  let oldest = 0;
  slider.addEventListener('input', () => {
    // From the span's oldest at the left to the present at the right, as on the bar's slider.
    onMa(oldest * (1 - Number(slider.value) / STEPS));
  });
  play.addEventListener('click', () => {
    onPlay(!playing);
  });
  return {
    root,
    render(view) {
      root.hidden = view === null;
      if (view === null) return;
      playing = view.playing;
      play.textContent = view.playing ? '❚❚' : '▶';
      play.setAttribute('aria-label', view.playing ? 'Pause' : 'Play');
      when.textContent = view.when;
      period.textContent = view.period;
      temperature.hidden = !view.temperature;
      oldest = view.oldest;
      const share = view.oldest > 0 ? Math.min(1, Math.max(0, 1 - view.ma / view.oldest)) : 1;
      if (document.activeElement !== slider) slider.value = String(Math.round(share * STEPS));
      slider.setAttribute('aria-valuetext', view.when);
    },
  };
}
