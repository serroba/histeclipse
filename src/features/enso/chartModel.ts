/**
 * The ENSO chart (#886), worked out apart from the page: each of NOAA's indices as a line on one
 * axis of °C (one quantity, so one axis), the ±threshold that names an episode, and under the
 * lines a strip for each index with its El Niño and La Niña episodes, so where they disagree is
 * seen at a glance; and the month shown.
 */

import { shared, spanOf, type Enso } from '../../data/enso';
import { episodeStrips, type EpisodeStrip } from '../../ui/ensoStrips';

export const CHART_WIDTH = 1000;
export const CHART_HEIGHT = 300;
/** The axis, °C: a little beyond the strongest El Niño and La Niña. */
const AXIS = { low: -2.5, high: 3 } as const;

export interface EnsoChart {
  readonly first: number;
  readonly last: number;
  readonly lines: readonly { readonly id: string; readonly d: string }[];
  /** Each index's episodes, as spans of the chart's width. */
  readonly strips: readonly EpisodeStrip[];
  readonly zeroY: number;
  /** The thresholds of El Niño (above) and La Niña (below). */
  readonly warmY: number;
  readonly coolY: number;
  /** The month shown, or null outside the files. */
  readonly cursorX: number | null;
}

export function ensoChart(enso: Enso, at: number): EnsoChart {
  const { first, last } = shared(enso);
  // A month's middle, so the first and last months each have their width.
  const x = (month: number): number => ((month - first + 0.5) / (last - first + 1)) * CHART_WIDTH;
  const y = (value: number): number =>
    ((AXIS.high - Math.min(AXIS.high, Math.max(AXIS.low, value))) / (AXIS.high - AXIS.low)) *
    CHART_HEIGHT;
  const fixed = (value: number): string => value.toFixed(1);
  const lines = enso.indices.map((index) => {
    const start = spanOf(index).first;
    const d = index.values
      .map((value, offset) => ({ month: start + offset, value }))
      .filter(({ month }) => month >= first && month <= last)
      .map(
        ({ month, value }, step) =>
          `${step === 0 ? 'M' : 'L'}${fixed(x(month))},${fixed(y(value))}`,
      )
      .join('');
    return { id: index.id, d };
  });
  const monthWidth = CHART_WIDTH / (last - first + 1);
  const strips = episodeStrips(enso, (month) => x(month) - monthWidth / 2, CHART_WIDTH);
  return {
    first,
    last,
    lines,
    strips,
    zeroY: y(0),
    warmY: y(enso.threshold),
    coolY: y(-enso.threshold),
    cursorX: at < first || at > last ? null : x(at),
  };
}
