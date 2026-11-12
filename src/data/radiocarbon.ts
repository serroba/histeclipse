/**
 * The radiocarbon calibration curves (`public/data/radiocarbon.json`), written by the pipeline's
 * `radiocarbon` command: IntCal20 for the northern hemisphere and SHCal20 for the southern
 * (Reimer et al. 2020; Hogg et al. 2020), each a row per calendar age (cal BP, years before 1950)
 * with the radiocarbon age the air then gave a sample and the air's Δ14C, each with its sigma.
 *
 * A radiocarbon age is not a date: the air's carbon-14 rose and fell, so one measured age fits
 * the curve at one or several stretches of years. Calibrating finds how well each calendar year
 * fits, and the ranges that hold most of the probability (Bronk Ramsey 2009 describes the method).
 */

import * as v from 'valibot';

import { elementAt } from '../util/arrays';
import { getJson, type Fetch } from './fetchJson';

const column = v.pipe(v.array(v.number()), v.minLength(2));

const CurveSchema = v.pipe(
  v.strictObject({
    cite: v.pipe(v.string(), v.minLength(1)),
    doi: v.pipe(v.string(), v.minLength(1)),
    calBP: column,
    age: column,
    sigma: column,
    delta: column,
    deltaSigma: column,
  }),
  v.check(
    ({ calBP, age, sigma, delta, deltaSigma }) =>
      [age, sigma, delta, deltaSigma].every((values) => values.length === calBP.length),
    'every column has a value for each row',
  ),
  v.check(
    ({ calBP }) => calBP.every((value, i) => i === 0 || elementAt(calBP, i - 1) < value),
    'rows run youngest first',
  ),
);

const RadiocarbonSchema = v.strictObject({
  schemaVersion: v.literal(1),
  accessed: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
  curves: v.strictObject({ intcal20: CurveSchema, shcal20: CurveSchema }),
});

export type Radiocarbon = v.InferOutput<typeof RadiocarbonSchema>;
export type CalibrationCurve = Radiocarbon['curves']['intcal20'];

export async function loadRadiocarbon(url: string, fetchJson: Fetch): Promise<Radiocarbon> {
  return getJson(fetchJson, url, RadiocarbonSchema);
}

/** The calendar year (astronomical: 0 is 1 BCE) of an age in years before 1950. */
export function yearOfCalBP(calBP: number): number {
  return 1950 - calBP;
}

/** How well each of the curve's calendar ages fits a measured age, summing to 1. */
export interface Calibration {
  readonly calBP: readonly number[];
  readonly probability: readonly number[];
}

/**
 * Calibrate a radiocarbon age (years BP) with its 1σ against a curve: at each calendar age, the
 * chance of measuring that age given the curve's own age and uncertainty there, weighted by the
 * years each row stands for (the curve is yearly back to 5,000 cal BP, then every 5, 10, 20).
 */
export function calibrate(age: number, sigma: number, curve: CalibrationCurve): Calibration {
  const { calBP } = curve;
  const raw = calBP.map((_, i) => {
    const spread = sigma ** 2 + elementAt(curve.sigma, i) ** 2;
    const miss = age - elementAt(curve.age, i);
    const before = i === 0 ? 0 : elementAt(calBP, i) - elementAt(calBP, i - 1);
    const after = i === calBP.length - 1 ? 0 : elementAt(calBP, i + 1) - elementAt(calBP, i);
    const width = (before + after) / 2 || 1;
    return (Math.exp(-(miss ** 2) / (2 * spread)) / Math.sqrt(spread)) * width;
  });
  const total = raw.reduce((sum, value) => sum + value, 0);
  return { calBP, probability: raw.map((value) => (total > 0 ? value / total : 0)) };
}

/** A stretch of calendar ages, oldest and youngest (cal BP), and the share of probability in it. */
export interface CalRange {
  readonly older: number;
  readonly younger: number;
  readonly share: number;
}

/**
 * The fewest calendar ages that together hold `level` of the probability (the highest density
 * region), gathered into ranges, oldest first: one, or several where the curve wiggles.
 */
export function highestDensity(calibration: Calibration, level = 0.954): readonly CalRange[] {
  const { calBP, probability } = calibration;
  const order = probability.map((value, i) => [value, i] as const).sort((a, b) => b[0] - a[0]);
  const kept = new Set<number>();
  let held = 0;
  for (const [value, i] of order) {
    if (held >= level) break;
    kept.add(i);
    held += value;
  }
  const ranges: CalRange[] = [];
  let open: { older: number; younger: number; share: number } | null = null;
  for (let i = calBP.length - 1; i >= 0; i -= 1) {
    if (!kept.has(i)) {
      if (open !== null) ranges.push(open);
      open = null;
      continue;
    }
    const at = elementAt(calBP, i);
    const share = elementAt(probability, i);
    open =
      open === null
        ? { older: at, younger: at, share }
        : { older: open.older, younger: at, share: open.share + share };
  }
  if (open !== null) ranges.push(open);
  return ranges;
}

function yearText(year: number): string {
  return year <= 0 ? `${String(1 - year)} BCE` : `${String(year)} CE`;
}

/** A range in calendar years, as archaeologists write it: "815–770 BCE", "1019–1155 CE". */
export function rangeText({ older, younger }: CalRange): string {
  const from = yearOfCalBP(older);
  const to = yearOfCalBP(younger);
  if (from <= 0 && to <= 0) return `${String(1 - from)}–${String(1 - to)} BCE`;
  if (from > 0 && to > 0) return `${String(from)}–${String(to)} CE`;
  return `${yearText(from)}–${yearText(to)}`;
}

/**
 * The share of its carbon-14 a sample has left, from its radiocarbon age: by convention ages use
 * Libby's half-life of 5,568 years, a mean life of 8,033 (Stuiver & Polach 1977). The true
 * half-life is 5,730 years; calibrating against the curve takes care of the difference.
 */
export function fractionLeft(age: number): number {
  return Math.exp(-age / 8033);
}

/** The calendar ages (cal BP) a chart of a calibration spans: its ranges with room either side. */
export function chartWindow(ranges: readonly CalRange[]): { older: number; younger: number } {
  const older = Math.max(...ranges.map(({ older: o }) => o));
  const younger = Math.min(...ranges.map(({ younger: y }) => y));
  const room = Math.max(50, (older - younger) * 0.4);
  return { older: older + room, younger: Math.max(0, younger - room) };
}
