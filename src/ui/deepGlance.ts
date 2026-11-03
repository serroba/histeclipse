/**
 * Deep time at a glance, for full view: when it is, the period, and how far through the span,
 * with Play, on a strip along the bottom while the panels are cleared away.
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

export function createDeepGlance(onPlay: (play: boolean) => void): DeepGlance {
  const play = element(
    'button',
    { type: 'button', class: 'deep-glance-play', 'aria-label': 'Play' },
    '▶',
  );
  const when = element('strong', { class: 'deep-glance-when' });
  const period = element('span', { class: 'deep-glance-period' });
  const fill = element('span', { class: 'deep-glance-fill' });
  const progress = element(
    'div',
    {
      class: 'deep-glance-track',
      role: 'progressbar',
      'aria-label': 'Time shown',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
    },
    fill,
  );
  const root = element(
    'div',
    { class: 'deep-glance', 'data-testid': 'deep-glance', hidden: '' },
    play,
    element('div', { class: 'deep-glance-body' }, element('p', {}, when, ' ', period), progress),
  );
  let playing = false;
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
      // From the span's oldest at the left to the present at the right, as on the slider.
      const share = view.oldest > 0 ? Math.min(1, Math.max(0, 1 - view.ma / view.oldest)) : 1;
      const percent = Math.round(share * 100);
      progress.setAttribute('aria-valuenow', String(percent));
      progress.setAttribute('aria-valuetext', view.when);
      fill.style.width = `${String(share * 100)}%`;
    },
  };
}
