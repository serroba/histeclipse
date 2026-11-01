/**
 * The bottom bar in deep time: drag through 540 million years (oldest on the left, so time runs
 * left to right), step 5 million years at a time, or play towards the present.
 * Mobile first: 44 px targets, like the year bar it replaces.
 */

import { formatMa, type Period } from '../deepTime/periods';
import { element } from './dom';

/** Each step button moves by one elevation map. */
export const STEP_MA = 5;

export interface DeepTimeView {
  readonly ma: number;
  /** The oldest moment the maps reach, Ma. */
  readonly oldest: number;
  readonly period: Period | null;
  readonly playing: boolean;
}

export interface DeepTimeBar {
  readonly root: HTMLElement;
  render(view: DeepTimeView | null): void;
}

export function createDeepTimeBar(handlers: {
  onMa(ma: number): void;
  onPlay(playing: boolean): void;
  onExit(): void;
}): DeepTimeBar {
  const play = element(
    'button',
    { type: 'button', class: 'step deep-play', 'aria-label': 'Play' },
    '▶',
  );
  const older = element(
    'button',
    { type: 'button', class: 'step', 'aria-label': `${String(STEP_MA)} million years earlier` },
    '‹',
  );
  const younger = element(
    'button',
    { type: 'button', class: 'step', 'aria-label': `${String(STEP_MA)} million years later` },
    '›',
  );
  // The slider's value is −Ma, so dragging right moves towards the present.
  const slider = element('input', {
    type: 'range',
    class: 'deep-slider',
    min: '-540',
    max: '0',
    step: '1',
    'aria-label': 'Millions of years ago',
  });
  const when = element('strong', { class: 'deep-when', 'data-testid': 'deep-when' });
  const period = element('span', { class: 'deep-period', 'data-testid': 'deep-period' });
  const exit = element('button', { type: 'button', class: 'deep-exit' }, 'Back to history');
  const root = element(
    'nav',
    { class: 'deep-time', 'aria-label': 'Deep time', hidden: '' },
    element('div', { class: 'deep-controls' }, play, older, slider, younger),
    element('p', { class: 'deep-label' }, when, ' ', period, exit),
  );

  let current: DeepTimeView | null = null;
  slider.addEventListener('input', () => {
    handlers.onMa(-Number(slider.value));
  });
  older.addEventListener('click', () => {
    if (current !== null) handlers.onMa(Math.min(current.oldest, current.ma + STEP_MA));
  });
  younger.addEventListener('click', () => {
    if (current !== null) handlers.onMa(Math.max(0, current.ma - STEP_MA));
  });
  play.addEventListener('click', () => {
    handlers.onPlay(!(current?.playing ?? false));
  });
  exit.addEventListener('click', () => {
    handlers.onExit();
  });

  return {
    root,
    render(view) {
      current = view;
      root.hidden = view === null;
      if (view === null) return;
      slider.min = String(-view.oldest);
      if (document.activeElement !== slider) slider.value = String(-view.ma);
      slider.setAttribute('aria-valuetext', formatMa(view.ma));
      when.textContent = formatMa(view.ma);
      period.textContent = view.period === null ? '' : `${view.period.name} · ${view.period.era}`;
      play.textContent = view.playing ? '❚❚' : '▶';
      play.setAttribute('aria-label', view.playing ? 'Pause' : 'Play');
    },
  };
}
