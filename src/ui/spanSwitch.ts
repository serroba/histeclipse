/**
 * How far the time bar reaches, as presets of range wherever time is shown (#730): the years,
 * the ice ages, the 540 million years of the elevation maps, or all of Earth's history. Going
 * deeper is zooming out, not switching modes.
 *
 * DOM glue, covered by the Playwright suite.
 */

import { SPAN_LABELS, type Span } from '../state/viewState';
import { element } from './dom';
import { spanIcon } from './icons';
import './spanSwitch.css';

export type { Span };

const SPANS: readonly (readonly [Span, string])[] = [
  ['years', 'The last 11,700 years, year by year: dates, states and eclipses'],
  ['ice', 'The last 2.6 million years: ice sheets, sea level, the first people'],
  ['all', 'The last 540 million years: moving continents, climate, life'],
  ['eons', 'All of Earth’s history'],
];

export interface SpanSwitch {
  readonly root: HTMLElement;
  /**
   * The span the bar shows, `within`, picked only while the bar shows all of it (`whole`): a
   * zoom into part of it (#1074) leaves no preset picked, that span marked as the one it is in.
   */
  render(within: Span, whole?: boolean): void;
}

export function createSpanSwitch(onSpan: (span: Span) => void): SpanSwitch {
  const buttons = SPANS.map(([span, title]) => {
    const button = element(
      'button',
      { type: 'button', class: 'time-option', 'aria-pressed': 'false', title },
      // The icon and the word, both kept on a phone: 540 Myr and 4.6 Gyr need their words (#1068).
      spanIcon(span),
      element('span', { class: 'icon-label icon-label-kept' }, SPAN_LABELS[span]),
    );
    button.addEventListener('click', () => {
      onSpan(span);
    });
    return [span, button] as const;
  });
  const root = element(
    'div',
    { class: 'time-switch', role: 'group', 'aria-label': 'Time range presets' },
    ...buttons.map(([, button]) => button),
  );
  return {
    root,
    render(within, whole = true) {
      for (const [each, button] of buttons) {
        button.setAttribute('aria-pressed', String(whole && each === within));
        button.classList.toggle('is-within', !whole && each === within);
      }
    },
  };
}
