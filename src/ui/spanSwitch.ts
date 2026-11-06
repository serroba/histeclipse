/**
 * How far the time bar reaches, as one choice wherever time is shown: the Holocene's years,
 * the ice ages, the 540 million years of the elevation maps, or all of Earth's history. Going
 * deeper is zooming out, not switching modes.
 *
 * DOM glue, covered by the Playwright suite.
 */

import type { DeepScale } from '../state/viewState';
import { element } from './dom';

export type Span = 'years' | DeepScale;

const SPANS: readonly (readonly [Span, string, string])[] = [
  ['years', 'Years', 'The last 11,700 years, year by year: dates, states and eclipses'],
  ['ice', 'Ice ages', 'The last 2.6 million years: ice sheets, sea level, the first people'],
  ['all', '540 Myr', 'The last 540 million years: moving continents, climate, life'],
  ['eons', '4.6 Gyr', 'All of Earth’s history'],
];

export interface SpanSwitch {
  readonly root: HTMLElement;
  render(span: Span): void;
}

export function createSpanSwitch(onSpan: (span: Span) => void): SpanSwitch {
  const buttons = SPANS.map(([span, label, title]) => {
    const button = element(
      'button',
      { type: 'button', class: 'time-option', 'aria-pressed': 'false', title },
      label,
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
