/**
 * Temperature from 800,000 years ago to now (`public/data/holocene-temperature.json`, #453): the
 * four records the Planetary Health Check 2026 draws its Figure 1 from, written by the pipeline's
 * `holocene-temperature` command. Three are global means against 1850–1900; EPICA Dome C is
 * Antarctic, against its own last 1,000 years, and is kept apart rather than rescaled.
 *
 * The chart spreads time over three panels, as the report's figure does: the ice ages, the
 * Holocene, and the industrial era, each linear in its own span. The Holocene corridor is the
 * band global temperature kept in the last 10,000 years before industry, in the reanalysis that
 * covers it (Osman et al. 2021): computed here, not drawn by hand.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from './fetchJson';

const Point = v.tuple([v.number(), v.number(), v.nullable(v.number()), v.nullable(v.number())]);

const SeriesSchema = v.strictObject({
  id: v.picklist(['epica', 'lgmr', 'pages2k', 'hadcrut5']),
  name: v.string(),
  scope: v.picklist(['antarctic', 'global']),
  baseline: v.string(),
  credit: v.string(),
  source: v.string(),
  note: v.optional(v.string()),
  /** The file's last year, which may be incomplete when it was downloaded. */
  lastYear: v.optional(v.number()),
  /** [year (astronomical, so 1 BCE is 0), median °C, low, high], oldest first. */
  points: v.array(Point),
});

const TemperatureSchema = v.strictObject({
  schemaVersion: v.literal(1),
  baseline: v.string(),
  series: v.array(SeriesSchema),
});

export type TemperatureSeries = v.InferOutput<typeof SeriesSchema>;
export type SeriesId = TemperatureSeries['id'];
export type HoloceneTemperature = v.InferOutput<typeof TemperatureSchema>;
type Point = TemperatureSeries['points'][number];

export async function loadHoloceneTemperature(
  url: string,
  fetchJson: Fetch,
): Promise<HoloceneTemperature> {
  return getJson(fetchJson, url, TemperatureSchema);
}

/** A span of time on the chart, and the share of its width it takes. */
export interface Panel {
  readonly from: number;
  readonly to: number;
  readonly share: number;
  readonly name: string;
}

export const PANELS: readonly Panel[] = [
  { from: -800_000, to: -20_000, share: 0.32, name: 'Ice ages' },
  { from: -20_000, to: 1750, share: 0.4, name: 'Holocene' },
  { from: 1750, to: 2030, share: 0.28, name: 'Industrial era' },
];

/** The temperatures the chart shows, °C. */
export const T_MIN = -10;
export const T_MAX = 4;

/** Where the corridor starts: 10,000 years before 1950. */
export const CORRIDOR_FROM = -8050;

/** Where `year` falls across the chart, 0 at its left edge to 1 at its right. */
export function xOf(year: number): number {
  let left = 0;
  for (const panel of PANELS) {
    if (year <= panel.to) {
      const within = Math.max(0, (year - panel.from) / (panel.to - panel.from));
      return left + within * panel.share;
    }
    left += panel.share;
  }
  return 1;
}

/** Where `celsius` falls down the chart, 0 at its top to 1 at its foot. */
export function yOf(celsius: number): number {
  return (T_MAX - Math.min(T_MAX, Math.max(T_MIN, celsius))) / (T_MAX - T_MIN);
}

export function seriesOf(data: HoloceneTemperature, id: SeriesId): TemperatureSeries {
  const found = data.series.find((each) => each.id === id);
  if (found === undefined) throw new Error(`No ${id} series in the temperature data`);
  return found;
}

/** A series' points, without a last year the file marks as possibly incomplete. */
export function completePoints(series: TemperatureSeries): readonly Point[] {
  const { lastYear } = series;
  return lastYear === undefined ? series.points : series.points.filter(([y]) => y < lastYear);
}

/** The band global temperature kept from `CORRIDOR_FROM` to industry, in the reanalysis. */
export function corridorOf(data: HoloceneTemperature): { low: number; high: number } {
  const values = seriesOf(data, 'lgmr')
    .points.filter(([year]) => year >= CORRIDOR_FROM)
    .map(([, median]) => median);
  return { low: Math.min(...values), high: Math.max(...values) };
}

/** The reanalysis' coldest, at the height of the last ice age. */
export function glacialLow(data: HoloceneTemperature): { year: number; celsius: number } {
  const [year, celsius] = seriesOf(data, 'lgmr').points.reduce((low, point) =>
    point[1] < low[1] ? point : low,
  );
  return { year, celsius };
}

/** The last complete year measured, and how far above 1850–1900 it was. */
export function latestYear(data: HoloceneTemperature): { year: number; celsius: number } {
  const points = completePoints(seriesOf(data, 'hadcrut5'));
  const last = points.at(-1);
  if (last === undefined) throw new Error('No complete year in HadCRUT5');
  return { year: last[0], celsius: last[1] };
}

/** An SVG path through the medians, in a `width` × `height` box. */
export function linePath(points: readonly Point[], width: number, height: number): string {
  return points
    .map(([year, median], index) => {
      const x = (xOf(year) * width).toFixed(1);
      const y = (yOf(median) * height).toFixed(1);
      return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
    })
    .join('');
}

/** An SVG path round the range (low to high), where the series gives one; '' where none. */
export function bandPath(points: readonly Point[], width: number, height: number): string {
  const ranged = points.filter(
    (point): point is [number, number, number, number] => point[2] !== null && point[3] !== null,
  );
  if (ranged.length === 0) return '';
  const at = (year: number, celsius: number) =>
    `${(xOf(year) * width).toFixed(1)} ${(yOf(celsius) * height).toFixed(1)}`;
  const upper = ranged.map(([year, , , high]) => at(year, high));
  const lower = ranged.map(([year, , low]) => at(year, low)).reverse();
  return `M${[...upper, ...lower].join('L')}Z`;
}
