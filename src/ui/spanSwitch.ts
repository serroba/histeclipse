/**
 * How far the time bar reaches, as one choice wherever time is shown: the Holocene's years,
 * the ice ages, the 540 million years of the elevation maps, or all of Earth's history. Going
 * deeper is zooming out, not switching modes.
 *
 * DOM glue, covered by the Playwright suite.
 */

import { SPAN_LABELS, type Span } from '../state/viewState';
import { element } from './dom';

export type { Span };

const SPANS: readonly (readonly [Span, string])[] = [
  ['years', 'The last 11,700 years, year by year: dates, states and eclipses'],
  ['ice', 'The last 2.6 million years: ice sheets, sea level, the first people'],
  ['all', 'The last 540 million years: moving continents, climate, life'],
  ['eons', 'All of Earth’s history'],
];

export interface SpanSwitch {
  readonly root: HTMLElement;
  render(span: Span): void;
}

export function createSpanSwitch(onSpan: (span: Span) => void): SpanSwitch {
  const buttons = SPANS.map(([span, title]) => {
    const button = element(
      'button',
      { type: 'button', class: 'time-option', 'aria-pressed': 'false', title },
      SPAN_LABELS[span],
    );
    button.addEventListener('click', () => {
      onSpan(span);
    });
    return [span, button] as const;
  });
  const root = element(
    'div',
    { class: 'time-switch', role: 'group', 'aria-label': 'Time span' },
    ...buttons.map(([, button]) => button),
  );
  return {
    root,
    render(span) {
      for (const [each, button] of buttons) {
        button.setAttribute('aria-pressed', String(each === span));
      }
    },
  };
}
