/**
 * GW150914 as LIGO measured it (#830): the file the pipeline writes from GWOSC's copy of the
 * discovery paper's Figure 1 (`data-pipeline/.../gw150914.py`), checked as it is read, and the
 * wave it gives the ring: h₊ the best-fit waveform at Livingston, h× the same a quarter cycle on,
 * taken from the merger, its pitch read from how fast the two turn about each other.
 *
 * Pure: no DOM, no three.js.
 */

import * as v from 'valibot';

import { turnBetween, type Polarisations, type Waveform } from './strain';

export const DETECTORS = ['H1', 'L1'] as const;

const STRAINS = v.array(v.pipe(v.number(), v.finite()));
const POSITIVE = v.pipe(v.number(), v.finite(), v.gtValue(0));
const SERIES = v.object({
  /** The strain it measured, band-passed, in `unit`s. */
  observed: STRAINS,
  /** The best-fit numerical-relativity waveform, as it would see it, in `unit`s. */
  waveform: STRAINS,
});

/** The file, checked as it is read: every series there and as long as the wave's own. */
export const GW150914_SCHEMA = v.pipe(
  v.object({
    event: v.literal('GW150914'),
    /** The moment its times are counted from. */
    utc: v.string(),
    /** The first sample, s after `utc`, and samples a second. */
    start: POSITIVE,
    rate: POSITIVE,
    /** What a strain of 1 in the series is. */
    unit: POSITIVE,
    /** When the merger was, s after `utc`: where the wave was strongest. */
    merger: POSITIVE,
    detectors: v.object({ H1: SERIES, L1: SERIES }),
    /** The wave's two polarisations, as the ring is drawn face on, in `unit`s. */
    plus: STRAINS,
    cross: STRAINS,
  }),
  v.check(
    (file) =>
      [
        file.cross,
        ...DETECTORS.flatMap((d) => [file.detectors[d].observed, file.detectors[d].waveform]),
      ].every((series) => series.length === file.plus.length) && file.plus.length > 1,
    'every series should be as long as the wave',
  ),
);
export type Gw150914 = v.InferOutput<typeof GW150914_SCHEMA>;

/** The value of `series` at `index`, between samples by a straight line; 0 outside it. */
function sample(series: readonly number[], index: number): number {
  const below = Math.floor(index);
  if (below < 0 || below >= series.length - 1) return 0;
  const share = index - below;
  return (series[below] ?? 0) * (1 - share) + (series[below + 1] ?? 0) * share;
}

/**
 * How far (s) the first series lags the second, and with which sign, over lags up to `most` s:
 * where the two line up best, one perhaps upside down.
 */
export function lag(
  later: readonly number[],
  earlier: readonly number[],
  rate: number,
  most: number,
): { readonly seconds: number; readonly inverted: boolean } {
  let best = { shift: 0, score: 0 };
  const reach = Math.round(most * rate);
  for (let shift = -reach; shift <= reach; shift += 1) {
    let score = 0;
    for (let index = 0; index < later.length; index += 1) {
      score += (later[index] ?? 0) * (earlier[index - shift] ?? 0);
    }
    if (Math.abs(score) > Math.abs(best.score)) best = { shift, score };
  }
  return { seconds: best.shift / rate, inverted: best.score < 0 };
}

/** The measured wave, as the ring plays it: s from the merger, in strain. */
export function measuredWave(data: Gw150914): Waveform {
  const { rate, unit } = data;
  const first = data.start - data.merger;
  const indexOf = (t: number): number => (t - first) * rate;
  const size = data.plus.map((plus, index) => Math.hypot(plus, data.cross[index] ?? 0));
  const peak = Math.max(...size);
  // Its pitch at each sample, from the turn of (h₊, h×) over four samples either side.
  const angle = data.plus.map((plus, index) => Math.atan2(data.cross[index] ?? 0, plus));
  const span = 4;
  const pitch = angle.map((_, index) => {
    if (index < span || index >= angle.length - span || (size[index] ?? 0) < peak * 0.1) return 0;
    let turned = 0;
    for (let step = index - span; step < index + span; step += 1) {
      turned += turnBetween(angle[step] ?? 0, angle[step + 1] ?? 0);
    }
    return Math.abs(turned) / (2 * span) / ((2 * Math.PI) / rate);
  });
  const start = first;
  const end = first + (data.plus.length - 1) / rate;
  return {
    start,
    end,
    peak: peak * unit,
    at(t): Polarisations {
      const index = indexOf(t);
      return { plus: sample(data.plus, index) * unit, cross: sample(data.cross, index) * unit };
    },
    frequency(t) {
      return pitch[Math.round(indexOf(t))] ?? 0;
    },
  };
}
