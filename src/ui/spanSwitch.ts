/**
 * How far the time bar reaches, as presets of range wherever time is shown (#730): the years,
 * the ice ages, the 540 million years of the elevation maps, or all of Earth's history. Going
 * deeper is zooming out, not switching modes.
 *
 * In the time bar's scale row (#1116), with the bar's zoom and the period crumbs: the presets
 * set how much time the bar shows, so they sit with it. On a phone a chip names the preset
 * shown and opens the four; picking one, Escape or a tap elsewhere closes them.
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
  /** The chip and the presets. */
  readonly root: HTMLElement;
  /** The presets themselves, a group of four buttons. */
  readonly group: HTMLElement;
  /**
   * The span the bar shows, `within`, picked only while the bar shows all of it (`whole`): a
   * zoom into part of it (#1074) leaves no preset picked, that span marked as the one it is in.
   */
  render(within: Span, whole?: boolean): void;
}

/** Switches made, for each group's own id. */
let made = 0;

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
      show(false);
      onSpan(span);
    });
    return [span, button] as const;
  });
  const group = element(
    'div',
    {
      class: 'time-switch',
      role: 'group',
      'aria-label': 'Time range presets',
      id: `time-switch-${String((made += 1))}`,
    },
    ...buttons.map(([, button]) => button),
  );
  const word = element('span', { class: 'time-scale-word' });
  const chip = element(
    'button',
    {
      type: 'button',
      class: 'time-scale-chip',
      'aria-expanded': 'false',
      'aria-controls': group.id,
    },
    word,
    element('span', { class: 'panel-fold-chevron', 'aria-hidden': 'true' }),
  );
  const root = element('div', { class: 'time-scale' }, chip, group);
  function show(open: boolean): void {
    root.toggleAttribute('data-open', open);
    chip.setAttribute('aria-expanded', String(open));
  }
  chip.addEventListener('click', () => {
    show(!root.hasAttribute('data-open'));
  });
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !root.hasAttribute('data-open')) return;
    show(false);
    chip.focus();
  });
  document.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Node && !root.contains(event.target)) show(false);
  });
  return {
    root,
    group,
    render(within, whole = true) {
      for (const [each, button] of buttons) {
        button.setAttribute('aria-pressed', String(whole && each === within));
        button.classList.toggle('is-within', !whole && each === within);
      }
      word.textContent = SPAN_LABELS[within];
      chip.setAttribute(
        'aria-label',
        `Time range: ${SPAN_LABELS[within]}${whole ? '' : ', part of it'}`,
      );
    },
  };
}
