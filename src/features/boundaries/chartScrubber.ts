/**
 * A chart as a slider: drag along it, or use the arrow keys, and `onScrub` hears how far across
 * the plot the reader has chosen, 0 to 1. The Holocene chart takes the globe to that year. DOM
 * glue, covered by the Playwright suite.
 */

/** Where the plot sits within the chart, px from its left. */
export interface PlotSpan {
  readonly left: number;
  readonly width: number;
}

/** A small step, about the width of a pixel or two on a wide chart; with Shift or Page keys, more. */
const STEP = 0.004;
const LEAP = 0.05;

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
    const step = event.shiftKey ? LEAP : STEP;
    const keys: Readonly<Record<string, number>> = {
      ArrowLeft: current() - step,
      ArrowDown: current() - step,
      ArrowRight: current() + step,
      ArrowUp: current() + step,
      PageDown: current() - LEAP,
      PageUp: current() + LEAP,
      Home: 0,
      End: 1,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onScrub(clamp(next));
  });
}
