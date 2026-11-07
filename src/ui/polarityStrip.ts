/**
 * The magnetic field's polarity along deep time's slider, as geologists draw it: black where it
 * pointed as today (normal), white where it was reversed, striped where it reversed too often to
 * draw, and faint where the record does not reach. Its words are for screen readers and the
 * tooltip; the deep-time notes say the same at the moment shown.
 *
 * DOM glue, covered by the Playwright suite; the spans are worked out in `deepTime/earthState`.
 */

import type { PolaritySpan } from '../deepTime/earthState';
import { element } from './dom';

export interface PolarityStrip {
  readonly root: HTMLElement;
  /** Draw the spans along a slider from `oldest` Ma (at the left) to today. */
  render(spans: readonly PolaritySpan[], oldest: number): void;
}

const WORDS: Readonly<Record<PolaritySpan['polarity'], string>> = {
  normal: 'normal, as today',
  reversed: 'reversed',
  mixed: 'reversing often',
  unknown: 'not known',
};

export function createPolarityStrip(): PolarityStrip {
  const bar = element('div', { class: 'polarity-bar' });
  const root = element(
    'div',
    {
      class: 'polarity-strip',
      'data-testid': 'polarity-strip',
      role: 'img',
      title: 'Magnetic polarity: black as today, white reversed, striped reversing often',
    },
    element(
      'span',
      { class: 'polarity-label', 'aria-hidden': 'true' },
      element('span', { class: 'polarity-label-long' }, 'Magnetic field: black as today · '),
      element('span', { class: 'polarity-label-short' }, 'Magnetic: black as now · '),
      'white reversed',
    ),
    bar,
  );
  let drawn = '';
  return {
    root,
    render(spans, oldest) {
      const key = `${String(oldest)}:${String(spans.length)}`;
      if (key === drawn) return;
      drawn = key;
      bar.replaceChildren(
        ...spans.map(({ young, old, polarity }) => {
          const span = element('span', {
            class: `polarity-span is-${polarity}`,
            'data-polarity': polarity,
          });
          span.style.left = `${String((1 - old / oldest) * 100)}%`;
          span.style.width = `${String(((old - young) / oldest) * 100)}%`;
          return span;
        }),
      );
      const reversals = spans.filter(({ polarity }) => polarity === 'reversed').length;
      root.setAttribute(
        'aria-label',
        `Magnetic polarity over the span: ${spans
          .filter(({ old, young }) => (old - young) / oldest > 0.05)
          .map(({ polarity }) => WORDS[polarity])
          .join(', then ')} from today back; ${String(reversals)} reversed spells drawn.`,
      );
    },
  };
}
