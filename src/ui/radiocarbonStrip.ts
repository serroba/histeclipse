/**
 * Carbon-14 in the air along the years' slider (#270): the calibration curve's Δ14C as a line,
 * higher when the air held more, with the Miyake events marked and the Hallstatt plateau shaded.
 * The curve stops in 1950, where the calibration curves end; after it, nuclear tests nearly
 * doubled the air's carbon-14 (the bomb pulse), which is said in words, not drawn. Below it,
 * the eruptions the ice cores record (#274), each a tick as tall as the sulfur it sent up.
 *
 * DOM glue, covered by the Playwright suite; the points are worked out in `stripPoints`.
 */

import type { CalibrationCurve } from '../data/radiocarbon';
import { yearOfCalBP } from '../data/radiocarbon';
import type { RadiocarbonEvent } from '../data/radiocarbonEvents';
import { eruptionText, LARGEST_SULFUR, type Eruption } from '../data/eruptions';
import { element } from './dom';
import './radiocarbonStrip.css';

const NS = 'http://www.w3.org/2000/svg';
/** Points along the line, at most: plenty for a strip a few hundred pixels wide. */
const MAX_POINTS = 600;

/** The line's points as shares across and up the strip, for years `first` to `last`. */
export function stripPoints(
  curve: CalibrationCurve,
  first: number,
  last: number,
): readonly (readonly [x: number, y: number])[] {
  const rows = curve.calBP
    .map((calBP, i) => [yearOfCalBP(calBP), curve.delta[i] ?? 0] as const)
    .filter(([year]) => year >= first && year <= last)
    .sort((a, b) => a[0] - b[0]);
  const step = Math.max(1, Math.ceil(rows.length / MAX_POINTS));
  const kept = rows.filter((_, i) => i % step === 0 || i === rows.length - 1);
  const values = kept.map(([, delta]) => delta);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = high - low || 1;
  return kept.map(([year, delta]) => [(year - first) / (last - first), (delta - low) / range]);
}

export interface RadiocarbonStrip {
  readonly root: HTMLElement;
  /** Draw it for years `first` to `last` (astronomical); null hides it. */
  render(
    view: {
      readonly curve: CalibrationCurve;
      readonly name: string;
      readonly first: number;
      readonly last: number;
      readonly events: readonly RadiocarbonEvent[];
      /** The eruptions in the years shown, or null until they load. */
      readonly eruptions: readonly Eruption[] | null;
    } | null,
  ): void;
}

export function createRadiocarbonStrip(
  why?: HTMLElement,
  /** Open "How was this dated?" on the curve drawn. */
  onDate?: (curve: CalibrationCurve, name: string) => void,
): RadiocarbonStrip {
  let shown: { readonly curve: CalibrationCurve; readonly name: string } | null = null;
  const date = element(
    'button',
    { type: 'button', class: 'radiocarbon-date' },
    'How was this dated?',
  );
  date.addEventListener('click', () => {
    if (shown !== null) onDate?.(shown.curve, shown.name);
  });
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'radiocarbon-line');
  svg.setAttribute('viewBox', '0 0 1000 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const marks = element('div', { class: 'radiocarbon-marks' });
  const eruptions = document.createElementNS(NS, 'svg');
  eruptions.setAttribute('class', 'radiocarbon-eruptions');
  eruptions.setAttribute('viewBox', '0 0 1000 30');
  eruptions.setAttribute('preserveAspectRatio', 'none');
  eruptions.setAttribute('data-testid', 'radiocarbon-eruptions');
  const label = element('span', { class: 'radiocarbon-label' });
  const root = element(
    'div',
    {
      class: 'radiocarbon-strip',
      'data-testid': 'radiocarbon-strip',
      role: 'img',
      hidden: '',
    },
    element('div', { class: 'radiocarbon-plot' }, svg, marks),
    eruptions,
    element(
      'span',
      { class: 'radiocarbon-caption' },
      label,
      ...(why === undefined ? [] : [why]),
      ...(onDate === undefined ? [] : [date]),
    ),
  );
  /** One tick per eruption, as tall as the square root of its sulfur against the largest. */
  function drawEruptions(shown: readonly Eruption[], first: number, last: number): void {
    const span = last - first || 1;
    eruptions.dataset['count'] = String(shown.length);
    eruptions.replaceChildren(
      ...shown.map((eruption) => {
        const height = 3 + 27 * Math.sqrt(Math.min(1, eruption.sulfur / LARGEST_SULFUR));
        const x = ((eruption.year - first) / span) * 1000;
        const tick = document.createElementNS(NS, 'line');
        tick.setAttribute('x1', x.toFixed(1));
        tick.setAttribute('x2', x.toFixed(1));
        tick.setAttribute('y1', '30');
        tick.setAttribute('y2', (30 - height).toFixed(1));
        tick.setAttribute('vector-effect', 'non-scaling-stroke');
        tick.setAttribute('class', eruption.name === null ? 'eruption' : 'eruption is-named');
        if (eruption.name !== null) tick.setAttribute('data-eruption', eruption.name);
        const title = document.createElementNS(NS, 'title');
        title.textContent = eruptionText(eruption);
        tick.append(title);
        return tick;
      }),
    );
  }

  let drawn = '';
  return {
    root,
    render(view) {
      root.hidden = view === null;
      shown = view;
      if (view === null) return;
      const key = `${view.name}:${String(view.first)}:${String(view.last)}:${String(view.eruptions?.length)}`;
      if (key === drawn) return;
      drawn = key;
      const points = stripPoints(view.curve, view.first, view.last);
      const line = document.createElementNS(NS, 'polyline');
      line.setAttribute(
        'points',
        points.map(([x, y]) => `${(x * 1000).toFixed(1)},${(95 - y * 90).toFixed(1)}`).join(' '),
      );
      line.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.replaceChildren(line);
      const span = view.last - view.first;
      marks.replaceChildren(
        ...view.events
          .filter(({ from, to }) => to >= view.first && from <= view.last)
          .map((event) => {
            const mark = element('span', {
              class: event.from === event.to ? 'radiocarbon-event' : 'radiocarbon-plateau',
              title: `${event.name}: ${event.text}`,
              'data-event': event.name,
            });
            mark.style.left = `${String(((event.from - view.first) / span) * 100)}%`;
            if (event.from !== event.to) {
              mark.style.width = `${String(((event.to - event.from) / span) * 100)}%`;
            }
            return mark;
          }),
      );
      drawEruptions(view.eruptions ?? [], view.first, view.last);
      label.textContent =
        view.eruptions === null
          ? `Carbon-14 in the air, ${view.name}: higher means more, up to 1950`
          : `Carbon-14 in the air, ${view.name}: higher means more, up to 1950. below, eruptions in the ice cores`;
      root.setAttribute(
        'aria-label',
        `Carbon-14 in the air over the years shown, from ${view.name}, with ${view.events
          .map(({ name }) => name)
          .join(', ')} marked.`,
      );
    },
  };
}
