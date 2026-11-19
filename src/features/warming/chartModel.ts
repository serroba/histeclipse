/**
 * The records' chart (#526), worked out apart from the page: every record as a line on one axis
 * of °C above 1850–1900 (one quantity, so one axis), the band between the lowest and highest of
 * them each year, and the year shown; under it, from 1950, each ENSO index's El Niño and La Niña
 * episodes (#890), on the same years.
 */

import type { Enso } from '../../data/enso';
import type { TemperatureRecords } from '../../data/temperatureRecords';
import { episodeStrips, type EpisodeStrip } from '../../ui/ensoStrips';

export const CHART_WIDTH = 1000;
export const CHART_HEIGHT = 300;
/** The axis, °C: a little beyond the records' coldest and warmest years. */
const AXIS = { low: -0.6, high: 1.8 } as const;

export interface RecordsChart {
  readonly first: number;
  readonly last: number;
  readonly lines: readonly { readonly id: string; readonly kind: string; readonly d: string }[];
  /** The spread's band, as an SVG path. */
  readonly band: string;
  /** Where the zero line (the 1850–1900 mean) is, and the year shown (null outside). */
  readonly zeroY: number;
  readonly cursorX: number | null;
  /** El Niño and La Niña by each index, on the records' years; none until they load. */
  readonly strips: readonly EpisodeStrip[];
}

export function recordsChart(
  records: TemperatureRecords,
  year: number,
  enso: Enso | null = null,
): RecordsChart {
  const first = records.spread[0]?.[0] ?? records.lastYear;
  const last = records.lastYear;
  const x = (at: number): number => ((at - first) / Math.max(1, last - first)) * CHART_WIDTH;
  const y = (value: number): number =>
    ((AXIS.high - Math.min(AXIS.high, Math.max(AXIS.low, value))) / (AXIS.high - AXIS.low)) *
    CHART_HEIGHT;
  const point = (at: number, value: number): string => `${x(at).toFixed(1)},${y(value).toFixed(1)}`;
  const lines = records.series.map((record) => ({
    id: record.id,
    kind: record.kind === 'reanalysis' ? 'reanalysis' : 'record',
    d: record.points
      .map(([at, value], index) => `${index === 0 ? 'M' : 'L'}${point(at, value)}`)
      .join(''),
  }));
  const top = records.spread.map(([at, , high]) => point(at, high));
  const bottom = records.spread.map(([at, low]) => point(at, low)).reverse();
  return {
    first,
    last,
    lines,
    band: top.length === 0 ? '' : `M${[...top, ...bottom].join('L')}Z`,
    zeroY: y(0),
    cursorX: year < first || year > last ? null : x(year),
    // A year's value sits at its middle, so a month starts a twelfth of a year in from half a
    // year before.
    strips: enso === null ? [] : episodeStrips(enso, (month) => x(month / 12 - 0.5), CHART_WIDTH),
  };
}
