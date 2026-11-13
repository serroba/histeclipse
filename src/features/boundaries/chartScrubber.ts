/**
 * A chart as a slider: drag along it, or use the arrow keys, and `onScrub` hears how far across
 * the plot the reader has chosen, 0 to 1. The Holocene chart takes the globe to that year. DOM
 * glue, covered by the Playwright suite; the keys' steps are in `scrubKeys.ts`.
 */

import { scrubKey } from './scrubKeys';

/** Where the plot sits within the chart, px from its left. */
export interface PlotSpan {
  readonly left: number;
  readonly width: number;
}

const clamp = (x: number) => Math.min(1, Math.max(0, x));

export function makeScrubbable(
  chart: SVGSVGElement,
  plot: () => PlotSpan,
  /** Where the cursor is now, 0 to 1, for the keys to step from. */
  current: () => number,
  onScrub: (x: number) => void,
): void {
  chart.setAttribute('role', 'slider');
  chart.setAttribute('tabindex', '0');
  chart.setAttribute('aria-valuemin', '0');
  chart.setAttribute('aria-valuemax', '100');

  function at(event: PointerEvent): number {
    const box = chart.getBoundingClientRect();
    const { left, width } = plot();
    return clamp((event.clientX - box.left - left) / width);
  }
  chart.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    chart.setPointerCapture(event.pointerId);
    chart.focus({ preventScroll: true });
    onScrub(at(event));
  });
  chart.addEventListener('pointermove', (event) => {
    if (chart.hasPointerCapture(event.pointerId)) onScrub(at(event));
  });
  chart.addEventListener('keydown', (event) => {
    const next = scrubKey(event.key, event.shiftKey, current());
    if (next === null) return;
    event.preventDefault();
    onScrub(next);
  });
}
