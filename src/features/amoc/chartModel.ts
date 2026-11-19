/**
 * The AMOC's charts (#925), worked out apart from the page: a row for each source over the
 * years shown, each on its own vertical scale (its values and range within those years), never
 * one axis for all: an index in kelvin is not a transport in sverdrups. A zero line where the
 * source gives anomalies, and the year shown marked.
 */

import { rangeOf, valueIn, valueText, type Amoc } from '../../data/amoc';

export const ROW_WIDTH = 1000;
export const ROW_HEIGHT = 100;

export interface AmocRow {
  readonly id: string;
  readonly label: string;
  readonly measures: string;
  readonly units: string;
  /** The source's value for the year shown, in words, or null where it has none. */
  readonly value: string | null;
  /** The line and the range's band as SVG paths, empty where there are no readings. */
  readonly line: string;
  readonly band: string;
  /** Where zero is, for a source of anomalies whose readings straddle it; else null. */
  readonly zeroY: number | null;
}

export interface AmocChart {
  readonly first: number;
  readonly last: number;
  readonly rows: readonly AmocRow[];
  /** The year shown across the rows, or null outside the years shown. */
  readonly cursorX: number | null;
}

const fixed = (value: number): string => value.toFixed(1);

export function amocChart(
  amoc: Amoc,
  span: { first: number; last: number },
  year: number,
): AmocChart {
  const { first, last } = span;
  const width = Math.max(1, last + 1 - first);
  const x = (at: number): number => ((at - first) / width) * ROW_WIDTH;
  const rows = amoc.series.map((series): AmocRow => {
    const range = rangeOf(series);
    const kept = series.years.flatMap((at, index) =>
      at >= first && at < last + 1
        ? [
            {
              at,
              value: series.values[index] ?? 0,
              low: range?.low[index] ?? series.values[index] ?? 0,
              high: range?.high[index] ?? series.values[index] ?? 0,
            },
          ]
        : [],
    );
    const value = valueIn(series, year);
    const base = {
      id: series.id,
      label: series.label,
      measures: series.measures,
      units: series.units,
      value: value === null ? null : valueText(series, value),
    };
    if (kept.length === 0) return { ...base, line: '', band: '', zeroY: null };
    const lowest = Math.min(...kept.map(({ low }) => low));
    const highest = Math.max(...kept.map(({ high }) => high));
    const pad = (highest - lowest) * 0.05 || 1;
    const bottom = lowest - pad;
    const top = highest + pad;
    const y = (value: number): number => ((top - value) / (top - bottom)) * ROW_HEIGHT;
    const point = (at: number, value: number): string => `${fixed(x(at))},${fixed(y(value))}`;
    const line = kept.map(({ at, value: v }, index) => `${index === 0 ? 'M' : 'L'}${point(at, v)}`);
    const band =
      range === null
        ? ''
        : `M${[
            ...kept.map(({ at, high }) => point(at, high)),
            ...[...kept].reverse().map(({ at, low }) => point(at, low)),
          ].join('L')}Z`;
    const anomalies = series.baseline !== null;
    return {
      ...base,
      line: line.join(''),
      band,
      zeroY: anomalies && bottom < 0 && top > 0 ? y(0) : null,
    };
  });
  return {
    first,
    last,
    rows,
    cursorX: year < first || year > last ? null : x(year + 0.5),
  };
}
