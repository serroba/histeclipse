/**
 * The ozone panel's two small charts (#722), worked out apart from the page: the hole's area each
 * spring, and the ozone-depleting gases over Antarctica (the NOAA index, 100 at its peak), on one
 * axis of years each (never two quantities on two axes). A year with no measurement breaks the
 * line; the Montreal Protocol and the year shown are marked.
 */

import { MONTREAL_YEAR, type OzoneHistory } from '../../data/ozone';

export const CHART_WIDTH = 1000;
export const CHART_HEIGHT = 120;

/** The hole's area axis, million km²: a little over its largest (29.9 in 2000). */
const AREA_TOP = 32;
/** The index's axis: 0 at 1980's level, 100 at the peak. */
const INDEX_TOP = 100;

export interface OzoneCharts {
  readonly first: number;
  readonly last: number;
  /** SVG path data, the area's line, broken where a year is missing. */
  readonly area: string;
  /** SVG path data, the index's line. */
  readonly gases: string;
  /** Where on the x axis the Montreal Protocol falls, and the year shown (null outside). */
  readonly montrealX: number;
  readonly cursorX: number | null;
  readonly missing: readonly number[];
}

function line(points: readonly (readonly [number, number] | null)[]): string {
  let path = '';
  let drawing = false;
  for (const point of points) {
    if (point === null) {
      drawing = false;
      continue;
    }
    path += `${drawing ? 'L' : 'M'}${point[0].toFixed(1)},${point[1].toFixed(1)}`;
    drawing = true;
  }
  return path;
}

export function ozoneCharts(history: OzoneHistory, year: number): OzoneCharts {
  const rows = history.hole.rows;
  const first = rows[0]?.[0] ?? MONTREAL_YEAR;
  const last = rows.at(-1)?.[0] ?? MONTREAL_YEAR;
  const x = (at: number): number => ((at - first) / Math.max(1, last - first)) * CHART_WIDTH;
  const y = (value: number, top: number): number =>
    CHART_HEIGHT - (Math.min(value, top) / top) * CHART_HEIGHT;
  return {
    first,
    last,
    area: line(rows.map(([at, area]) => (area === null ? null : [x(at), y(area, AREA_TOP)]))),
    gases: line(history.gases.antarctic.map(([at, , index]) => [x(at), y(index, INDEX_TOP)])),
    montrealX: x(MONTREAL_YEAR),
    cursorX: year < first || year > last ? null : x(year),
    missing: history.hole.missing,
  };
}
