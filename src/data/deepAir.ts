/**
 * Carbon dioxide and oxygen over the last 540 million years (`public/data/air-deep.json`), by
 * the pipeline's `deep-air` command: Foster, Royer & Lunt's (2017) CO2 fit with its 68% and 95%
 * bands and the proxy estimates it rests on, by proxy; and Mills et al.'s (2023) combined O2
 * estimate with its range. Nitrogen has no such record: what is known is said in words.
 */

import * as v from 'valibot';

import { elementAt } from '../util/arrays';
import { getJson, type Fetch } from '../util/fetchJson';

const ma = v.pipe(v.number(), v.minValue(0));
const ppm = v.pipe(v.number(), v.minValue(0));
const doi = v.pipe(v.string(), v.regex(/^10\.\d{4,9}\/\S+$/));

const DeepAirSchema = v.strictObject({
  schemaVersion: v.literal(1),
  co2: v.strictObject({
    credit: v.pipe(v.string(), v.minLength(1)),
    doi,
    /** Each: Ma, best, low 95%, low 68%, high 68%, high 95% (ppm), youngest first. */
    fit: v.pipe(v.array(v.tuple([ma, ppm, ppm, ppm, ppm, ppm])), v.minLength(2)),
    proxies: v.array(
      v.strictObject({
        name: v.pipe(v.string(), v.minLength(1)),
        /** Each: Ma, ppm, low and high (null where not given). */
        estimates: v.array(v.tuple([ma, ppm, v.nullable(ppm), v.nullable(ppm)])),
      }),
    ),
  }),
  o2: v.strictObject({
    credit: v.pipe(v.string(), v.minLength(1)),
    doi,
    /** Each: Ma, best guess, lowest, highest (% of the air), youngest first. */
    points: v.pipe(v.array(v.tuple([ma, v.number(), v.number(), v.number()])), v.minLength(2)),
  }),
});

export type DeepAir = v.InferOutput<typeof DeepAirSchema>;

export async function loadDeepAir(url: string, fetchJson: Fetch): Promise<DeepAir> {
  return getJson(fetchJson, url, DeepAirSchema);
}

/** A row of a series by age (its first value), between the two around `at`; null beyond it. */
function between(rows: readonly (readonly number[])[], at: number): readonly number[] | null {
  // The schemas give every series two rows or more, each starting with its age.
  const age = (row: readonly number[]) => elementAt(row, 0);
  if (at < age(elementAt(rows, 0)) || at > age(elementAt(rows, rows.length - 1))) return null;
  const after = Math.max(
    1,
    rows.findIndex((row) => age(row) >= at),
  );
  const older = elementAt(rows, after);
  const younger = elementAt(rows, after - 1);
  const share = (at - age(younger)) / (age(older) - age(younger));
  return younger.map((value, index) => value + share * (elementAt(older, index) - value));
}

/** CO2 `at` million years ago by the fit: best, and the 68% and 95% ranges; null beyond it. */
export function co2At(
  data: DeepAir,
  at: number,
): {
  readonly best: number;
  readonly likely: readonly [number, number];
  readonly possible: readonly [number, number];
} | null {
  const row = between(data.co2.fit, at);
  if (row === null) return null;
  const [, best = 0, low95 = 0, low68 = 0, high68 = 0, high95 = 0] = row;
  return { best, likely: [low68, high68], possible: [low95, high95] };
}

/** O2 `at` million years ago: the best guess and the range, % of the air; null beyond it. */
export function o2At(
  data: DeepAir,
  at: number,
): { readonly best: number; readonly range: readonly [number, number] } | null {
  const row = between(data.o2.points, at);
  if (row === null) return null;
  const [, best = 0, low = 0, high = 0] = row;
  return { best, range: [low, high] };
}

/** How far back the CO2 fit reaches, Ma. */
export function co2Reach(data: DeepAir): number {
  return elementAt(data.co2.fit, data.co2.fit.length - 1)[0];
}

/** The proxy estimates within `window` million years of `at`, by proxy, most first. */
export function estimatesNear(
  data: DeepAir,
  at: number,
  window: number,
): readonly { readonly name: string; readonly count: number }[] {
  return data.co2.proxies
    .map(({ name, estimates }) => ({
      name,
      count: estimates.filter(([when]) => Math.abs(when - at) <= window).length,
    }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count);
}

const round = (value: number) => Math.round(value).toLocaleString('en');
const percent = (value: number) => value.toFixed(value < 10 ? 1 : 0);

/** Today's levels, to compare: CO2 before industry (IPCC AR6), O2 in the air now. */
export const PREINDUSTRIAL_CO2 = 278;
export const O2_TODAY = 20.9;

/** What the bar says of CO2 at a moment. */
export function co2Text(data: DeepAir, at: number): string {
  const co2 = co2At(data, at);
  if (co2 === null) {
    return `Carbon dioxide (CO₂): the compilation’s fit reaches ${String(co2Reach(data))} million years back, not this far.`;
  }
  const times = co2.best / PREINDUSTRIAL_CO2;
  const near = estimatesNear(data, at, 5);
  const proxies =
    near.length === 0
      ? ' No estimates within 5 million years: the fit bridges the gap.'
      : ` Estimates within 5 million years: ${near.map(({ name, count }) => `${name} ${String(count)}`).join(', ')}.`;
  return `Carbon dioxide (CO₂): about ${round(co2.best)} ppm (${times.toFixed(1)}× the 1750 level); likely ${round(co2.likely[0])}–${round(co2.likely[1])}, possibly ${round(co2.possible[0])}–${round(co2.possible[1])}.${proxies}`;
}

/** What the bar says of O2 at a moment. */
export function o2Text(data: DeepAir, at: number): string {
  const o2 = o2At(data, at);
  if (o2 === null) return 'Oxygen (O₂): the estimate begins 541 million years ago.';
  return `Oxygen (O₂): about ${percent(o2.best)}% of the air (today ${String(O2_TODAY)}%); the methods combined range ${percent(o2.range[0])}–${percent(o2.range[1])}%.`;
}

/** Nitrogen, in words: no record firm enough to chart, and the views on it. */
export const NITROGEN_NOTE = {
  text: 'Nitrogen (N₂): 78% of the air today; no record is firm enough to chart. One model keeps it near today’s level through these 540 million years; another lets the atmosphere’s nitrogen change a good deal over Earth’s history; fossil raindrops and lava bubbles suggest thinner air 2.7 billion years ago.',
  sources: [
    { label: 'Berner 2006', doi: '10.1130/G22470.1' },
    { label: 'Johnson & Goldblatt 2018', doi: '10.1029/2017GC007392' },
    { label: 'Som et al. 2012', doi: '10.1038/nature10890' },
    { label: 'Som et al. 2016', doi: '10.1038/ngeo2713' },
  ],
} as const;
