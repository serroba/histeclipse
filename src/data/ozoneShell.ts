/**
 * The ozone layer as a surface round the Earth, day by day (#804), as `ozone/shell.json` names
 * its seasons (the pipeline's `ozone-shell`): where ozone's partial pressure is 12 mPa, as the
 * Copernicus Atmosphere Monitoring Service draws the ozone hole, from the CAMS reanalysis
 * (EAC4), each day from 1 July to 31 December. Each season is one image, its days one under the
 * other, each pixel a column of air: red the surface's lower height, green its upper, blue the
 * total ozone; red 0 where no height holds that much ozone, which is the hole.
 */

import * as v from 'valibot';

import { elementAt } from '../util/arrays';
import { getJson, type Fetch } from '../util/fetchJson';

const text = v.pipe(v.string(), v.minLength(1));
const whole = v.pipe(v.number(), v.integer(), v.minValue(1));

const ShellSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: text,
  source: v.pipe(v.string(), v.url()),
  licence: text,
  /** The surface: where ozone's partial pressure is this, mPa. */
  surfaceMPa: v.number(),
  holeDU: v.number(),
  levelsHPa: v.array(v.number()),
  scaleHeightKm: v.number(),
  /** Rows from `north` southward and columns from `west` eastward, `stepDeg` apart. */
  grid: v.strictObject({
    rows: whole,
    columns: whole,
    stepDeg: v.pipe(v.number(), v.minValue(0.1)),
    north: v.number(),
    west: v.number(),
  }),
  /** A height's byte b is `heightOffsetKm + b × heightStepKm`; ozone's, `offsetDU + b × stepDU`. */
  encoding: v.strictObject({
    heightOffsetKm: v.number(),
    heightStepKm: v.pipe(v.number(), v.minValue(0.001)),
    offsetDU: v.number(),
    stepDU: v.pipe(v.number(), v.minValue(0.1)),
  }),
  seasons: v.array(
    v.strictObject({
      year: v.pipe(v.number(), v.integer()),
      file: v.pipe(v.string(), v.regex(/^shell-\d{4}\.png$/)),
      first: v.pipe(v.string(), v.isoDate()),
      days: whole,
      /** Each day's area of the south under the hole's line, million km². */
      belowMkm2: v.array(v.number()),
    }),
  ),
});

export type OzoneShell = v.InferOutput<typeof ShellSchema>;
type ShellSeason = OzoneShell['seasons'][number];

export async function loadOzoneShell(url: string, fetchJson: Fetch): Promise<OzoneShell> {
  return getJson(fetchJson, url, ShellSchema);
}

/** A day of a season: which season, and how many days after its first. */
export interface ShellDayOf {
  readonly season: ShellSeason;
  readonly day: number;
}

const DAY_MS = 86_400_000;

/** The season and day a date falls in (UTC); null outside every season. */
export function shellDayOf(
  shell: OzoneShell,
  date: { readonly year: number; readonly month: number; readonly day: number },
): ShellDayOf | null {
  const season = seasonOf(shell, date.year);
  if (season === null) return null;
  const at = Date.UTC(date.year, date.month - 1, date.day);
  const day = Math.round((at - Date.parse(`${season.first}T00:00:00Z`)) / DAY_MS);
  return day >= 0 && day < season.days ? { season, day } : null;
}

/** A day's surface, a value for each column of air, rows from the north, columns eastward. */
export interface ShellField {
  readonly rows: number;
  readonly columns: number;
  /** The surface's lower and upper heights, km; NaN where there is no surface. */
  readonly lowerKm: Float32Array;
  readonly upperKm: Float32Array;
  /** Total ozone, Dobson units. */
  readonly du: Float32Array;
}

/**
 * Read a day from a season's pixels (RGBA bytes of its image, its days one under the other).
 */
export function shellField(shell: OzoneShell, pixels: Uint8ClampedArray, day: number): ShellField {
  const { rows, columns } = shell.grid;
  const { heightOffsetKm, heightStepKm, offsetDU, stepDU } = shell.encoding;
  const cells = rows * columns;
  const lowerKm = new Float32Array(cells);
  const upperKm = new Float32Array(cells);
  const du = new Float32Array(cells);
  const bytes = new DataView(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  const start = day * cells * 4;
  for (let cell = 0; cell < cells; cell += 1) {
    const at = start + cell * 4;
    const lower = bytes.getUint8(at);
    const upper = bytes.getUint8(at + 1);
    const there = lower > 0 && upper > 0;
    lowerKm[cell] = there ? heightOffsetKm + lower * heightStepKm : Number.NaN;
    upperKm[cell] = there ? heightOffsetKm + upper * heightStepKm : Number.NaN;
    du[cell] = offsetDU + bytes.getUint8(at + 2) * stepDU;
  }
  return { rows, columns, lowerKm, upperKm, du };
}

/**
 * The same field with `factor` times as many points each way, each between four of the
 * field's, weighed by how near it is to them (round the globe eastward; the poles its ends).
 * A point has a surface where the nearer part of the four do, its heights from those alone: so
 * an opening's edge runs smoothly between the columns of air, not in their steps.
 */
export function finerField(field: ShellField, factor: number): ShellField {
  const rows = (field.rows - 1) * factor + 1;
  const columns = field.columns * factor;
  const lowerKm = new Float32Array(rows * columns);
  const upperKm = new Float32Array(rows * columns);
  const du = new Float32Array(rows * columns);
  // What a point takes from the cells about it, kept in one place: this runs for every point of
  // every day played, and must not allocate for each (#819).
  const sum = { weight: 0, lower: 0, upper: 0, ozone: 0 };
  const take = (row: number, column: number, share: number): void => {
    const cell = row * field.columns + column;
    sum.ozone += share * Number(field.du[cell]);
    const low = Number(field.lowerKm[cell]);
    if (Number.isNaN(low)) return;
    sum.weight += share;
    sum.lower += share * low;
    sum.upper += share * Number(field.upperKm[cell]);
  };
  for (let row = 0; row < rows; row += 1) {
    const north = Math.min(Math.floor(row / factor), field.rows - 2);
    const down = row / factor - north;
    for (let column = 0; column < columns; column += 1) {
      const west = Math.floor(column / factor);
      const east = (west + 1) % field.columns;
      const along = column / factor - west;
      sum.weight = 0;
      sum.lower = 0;
      sum.upper = 0;
      sum.ozone = 0;
      take(north, west, (1 - down) * (1 - along));
      take(north, east, (1 - down) * along);
      take(north + 1, west, down * (1 - along));
      take(north + 1, east, down * along);
      const at = row * columns + column;
      du[at] = sum.ozone;
      lowerKm[at] = sum.weight >= 0.5 ? sum.lower / sum.weight : Number.NaN;
      upperKm[at] = sum.weight >= 0.5 ? sum.upper / sum.weight : Number.NaN;
    }
  }
  return { rows, columns, lowerKm, upperKm, du };
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** The date of a season's day (UTC): its year, month and day of the month. */
function shellDateOf(
  season: ShellSeason,
  day: number,
): { readonly year: number; readonly month: number; readonly day: number } {
  const at = new Date(Date.parse(`${season.first}T00:00:00Z`) + day * DAY_MS);
  return { year: at.getUTCFullYear(), month: at.getUTCMonth() + 1, day: at.getUTCDate() };
}

/** The season of a year, if it has one. */
function seasonOf(shell: OzoneShell, year: number): ShellSeason | null {
  return shell.seasons.find((each) => each.year === year) ?? null;
}

/** A season's day as written: "12 September 2006". */
export function shellDate({ season, day }: ShellDayOf): string {
  const at = shellDateOf(season, day);
  return `${String(at.day)} ${elementAt(MONTHS, at.month - 1)} ${String(at.year)}`;
}

/** What a day's surface shows, in a line. */
export function shellText(shell: OzoneShell, found: ShellDayOf): string {
  const area = Number(found.season.belowMkm2[found.day]);
  const hole =
    area > 0
      ? `total ozone under ${String(shell.holeDU)} Dobson units over about ${area.toFixed(1)} million km² of the south`
      : `nowhere in the south under ${String(shell.holeDU)} Dobson units`;
  return `The ozone layer on ${shellDate(found)} at 12:00 UT, as the surface where ozone’s partial pressure is ${String(shell.surfaceMPa)} mPa, coloured by total ozone: ${hole}. Where no height holds that much ozone the surface is open. Its heights are drawn ${String(HEIGHTS_DRAWN)} times larger than life.`;
}

/**
 * How the surface is raised off the globe, in Earth radii: `SHELL_BASE` at `SHELL_BASE_KM`, and
 * `SHELL_PER_KM` more for each km above. A km of height is drawn as some 38 km.
 */
const SHELL_BASE = 1.03;
const SHELL_BASE_KM = 10;
const SHELL_PER_KM = 0.006;
const EARTH_KM = 6371;
/** How many times larger than life the surface's heights are drawn, to the nearest ten. */
export const HEIGHTS_DRAWN = Math.round((SHELL_PER_KM * EARTH_KM) / 10) * 10;

/** How far from Earth's centre a height is drawn, Earth radii. */
export function shellRadius(km: number): number {
  return SHELL_BASE + (km - SHELL_BASE_KM) * SHELL_PER_KM;
}
