/**
 * Deep time at a glance, for full view: when it is, the period, and how far through the span,
 * with Play, on a strip along the bottom while the panels are cleared away. Its bar is a
 * slider: tap or drag it to any moment of the span.
 *
 * DOM glue, covered by the Playwright suite.
 */

import { element } from './dom';

export interface DeepGlanceView {
  /** How long ago, in words, and the period. */
  readonly when: string;
  readonly period: string;
  /** Million years ago shown, and the span's oldest. */
  readonly ma: number;
  readonly oldest: number;
  readonly playing: boolean;
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
  const root = element(
    'div',
    { class: 'deep-glance', 'data-testid': 'deep-glance', hidden: '' },
    play,
    element('div', { class: 'deep-glance-body' }, element('p', {}, when, ' ', period), slider),
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
      oldest = view.oldest;
      const share = view.oldest > 0 ? Math.min(1, Math.max(0, 1 - view.ma / view.oldest)) : 1;
      if (document.activeElement !== slider) slider.value = String(Math.round(share * STEPS));
      slider.setAttribute('aria-valuetext', view.when);
    },
  };
}
