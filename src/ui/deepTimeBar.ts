/**
 * The bottom bar in deep time: drag through 540 million years (oldest on the left, so time runs
 * left to right), step 5 million years at a time, or play towards the present.
 * Mobile first: 44 px targets, like the year bar it replaces.
 */

import { earthFacts } from '../deepTime/earthFacts';
import { anchorMa, MILESTONES } from '../deepTime/milestones';
import { formatMa, type Period } from '../deepTime/periods';
import type { SeaLevelIndex } from '../data/seaLevel';
import { element } from './dom';
import { createMilestonePanel } from './milestonePanel';
import { createSeaLevelChart } from './seaLevelChart';

/** Each step button moves by one elevation map. */
export const STEP_MA = 5;

export interface TemperatureView {
  readonly on: boolean;
  /** Global mean then and today, °C; null while the maps load. */
  readonly mean: number | null;
  readonly today: number | null;
  /** What the site says about the map shown, if anything. */
  readonly note: string | null;
}

/** The legend's stops, °C, matching the globe's shader. */
export const TEMPERATURE_STOPS: readonly (readonly [number, string])[] = [
  [-40, '#313695'],
  [-20, '#4575b4'],
  [-5, '#91bfdb'],
  [5, '#e0f3f8'],
  [15, '#fee090'],
  [22, '#fdae61'],
  [28, '#f46d43'],
  [35, '#d73027'],
  [45, '#a50026'],
];

/** A CSS gradient through the stops, placed by temperature. */
export function legendGradient(stops: readonly (readonly [number, string])[]): string {
  const first = stops[0]?.[0] ?? 0;
  const last = stops.at(-1)?.[0] ?? 1;
  const placed = stops.map(
    ([celsius, colour]) => `${colour} ${((100 * (celsius - first)) / (last - first)).toFixed(1)}%`,
  );
  return `linear-gradient(to right, ${placed.join(', ')})`;
}

export function temperatureText(view: TemperatureView): string {
  if (view.mean === null) return 'Loading temperature maps…';
  const today = view.today === null ? '' : ` (today ${view.today.toFixed(1)} °C)`;
  return `Global mean ${view.mean.toFixed(1)} °C${today}`;
}

export interface DeepTimeView {
  readonly ma: number;
  /** The oldest moment the maps reach, Ma. */
  readonly oldest: number;
  readonly period: Period | null;
  readonly playing: boolean;
  readonly temperature: TemperatureView;
  /** Sea level: off, on while the reconstructions load (null), or on with them. */
  readonly seaLevel:
    { readonly on: false } | { readonly on: true; readonly index: SeaLevelIndex | null };
}

export interface DeepTimeBar {
  readonly root: HTMLElement;
  render(view: DeepTimeView | null): void;
}

export function createDeepTimeBar(handlers: {
  onMa(ma: number): void;
  onPlay(playing: boolean): void;
  onExit(): void;
  onTemperature(on: boolean): void;
  onSeaLevel(on: boolean): void;
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
  const seaLevelButton = element(
    'button',
    { type: 'button', class: 'deep-layer', 'aria-pressed': 'false' },
    'Sea level',
  );
  const seaLevel = createSeaLevelChart({
    onKa(ka) {
      handlers.onMa(ka / 1000);
    },
  });
  const temperatureButton = element(
    'button',
    { type: 'button', class: 'deep-layer', 'aria-pressed': 'false' },
    'Temperature',
  );
  const legendScale = element('span', { class: 'temperature-scale', 'aria-hidden': 'true' });
  legendScale.style.background = legendGradient(TEMPERATURE_STOPS);
  const legendMean = element('span', { 'data-testid': 'temperature-mean' });
  const legendNote = element('p', { class: 'temperature-note', hidden: '' });
  const legend = element(
    'div',
    { class: 'temperature-legend', hidden: '' },
    element(
      'div',
      { class: 'temperature-scale-row' },
      element('span', {}, '−40 °C'),
      legendScale,
      element('span', {}, '45 °C'),
    ),
    element(
      'p',
      {},
      legendMean,
      ' · Scotese 2022, HadCM3L climate model adjusted to rock and isotope records',
    ),
    legendNote,
  );
  // Poles, field, tilt and day: folded away, so the bar stays small on a phone.
  const facts = element('dl', { class: 'deep-facts-list' });
  const factsPanel = element(
    'details',
    { class: 'deep-facts', 'data-testid': 'deep-facts' },
    element('summary', {}, 'Poles, magnetic field, tilt and day'),
    facts,
  );
  // A tick on the track for each milestone, placed when the time line's span is known.
  const marks = element('div', { class: 'deep-marks', 'aria-hidden': 'true' });
  const track = element('div', { class: 'deep-track' }, seaLevel.chart, slider, marks);
  const milestones = createMilestonePanel({
    onMa(ma) {
      handlers.onMa(ma);
    },
  });
  const root = element(
    'nav',
    { class: 'deep-time', 'aria-label': 'Deep time', hidden: '' },
    element('div', { class: 'deep-controls' }, play, older, track, younger),
    element(
      'p',
      { class: 'deep-label' },
      when,
      ' ',
      period,
      seaLevelButton,
      temperatureButton,
      exit,
    ),
    seaLevel.legend,
    legend,
    milestones.root,
    factsPanel,
  );

  let current: DeepTimeView | null = null;
  // The span the ticks were placed for.
  let marksSpan = 0;
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
  seaLevelButton.addEventListener('click', () => {
    handlers.onSeaLevel(!(current?.seaLevel.on ?? false));
  });
  temperatureButton.addEventListener('click', () => {
    handlers.onTemperature(!(current?.temperature.on ?? false));
  });

  return {
    root,
    render(view) {
      current = view;
      root.hidden = view === null;
      if (view === null) return;
      if (marksSpan !== view.oldest) {
        marksSpan = view.oldest;
        marks.replaceChildren(
          ...MILESTONES.filter((milestone) => anchorMa(milestone) <= view.oldest).map(
            (milestone) => {
              const mark = element('span', {
                class: `deep-mark milestone-${milestone.kind}`,
                title: milestone.title,
              });
              mark.style.left = `${String((1 - anchorMa(milestone) / view.oldest) * 100)}%`;
              return mark;
            },
          ),
        );
      }
      slider.min = String(-view.oldest);
      if (document.activeElement !== slider) slider.value = String(-view.ma);
      slider.setAttribute('aria-valuetext', formatMa(view.ma));
      when.textContent = formatMa(view.ma);
      period.textContent = view.period === null ? '' : `${view.period.name} · ${view.period.era}`;
      facts.replaceChildren(
        ...earthFacts(view.ma).flatMap(({ label, text }) => [
          element('dt', {}, label),
          element('dd', {}, text),
        ]),
      );
      milestones.render(view.ma);
      seaLevelButton.setAttribute('aria-pressed', String(view.seaLevel.on));
      seaLevel.render(
        view.seaLevel.on ? view.seaLevel.index : null,
        view.ma * 1000,
        view.oldest * 1000,
      );
      const { temperature } = view;
      temperatureButton.setAttribute('aria-pressed', String(temperature.on));
      legend.hidden = !temperature.on;
      legendMean.textContent = temperatureText(temperature);
      legendNote.hidden = temperature.note === null;
      legendNote.textContent = temperature.note ?? '';
      play.textContent = view.playing ? '❚❚' : '▶';
      play.setAttribute('aria-label', view.playing ? 'Pause' : 'Play');
    },
  };
}
