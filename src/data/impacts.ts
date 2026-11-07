/**
 * Impact craters and impact deposits (`public/data/impacts.json`), from the Impact Earth
 * Database (Western University) by the pipeline's `impacts` command: each with its place, size,
 * target rock and age as the database writes it, read into the oldest and youngest it allows,
 * and its place every 5 million years back on the PALEOMAP reconstruction (the deep-time maps').
 */

import * as v from 'valibot';

import { formatMa } from '../deepTime/periods';
import type { GeoPoint } from '../state/viewState';
import { getJson, type Fetch } from './fetchJson';

const Ma = v.nullable(v.pipe(v.number(), v.minValue(0)));
const integer = v.pipe(v.number(), v.integer());

const ImpactsSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.url()),
  accessed: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
  stepMa: v.pipe(v.number(), v.gtValue(0)),
  scale: v.pipe(v.number(), v.gtValue(0)),
  impacts: v.array(
    v.strictObject({
      id: integer,
      kind: v.picklist(['hypervelocity', 'crater', 'deposit']),
      name: v.pipe(v.string(), v.minLength(1)),
      country: v.string(),
      region: v.string(),
      target: v.string(),
      age: v.string(),
      olderMa: Ma,
      youngerMa: Ma,
      diameterKm: v.nullable(v.pipe(v.number(), v.gtValue(0))),
      /** Its place at each step back from today, latitude and longitude × scale; null on no plate. */
      then: v.pipe(v.array(v.nullable(v.tuple([integer, integer]))), v.minLength(1)),
    }),
  ),
  leftOut: v.array(
    v.strictObject({ name: v.string(), kind: v.string(), why: v.pipe(v.string(), v.minLength(1)) }),
  ),
});

export type Impacts = v.InferOutput<typeof ImpactsSchema>;
export type Impact = Impacts['impacts'][number];
export type ImpactKind = Impact['kind'];

export async function loadImpacts(url: string, fetchJson: Fetch): Promise<Impacts> {
  return getJson(fetchJson, url, ImpactsSchema);
}

/** An impact as marked at a moment: where it lay then, and whether it had surely struck. */
export interface ImpactMark {
  readonly impact: Impact;
  readonly point: GeoPoint;
  /** Its age spans the moment: it may not have struck yet. */
  readonly uncertain: boolean;
}

function between(a: number, b: number, mix: number): number {
  return a + (b - a) * mix;
}

/** Where an impact lay `ma` million years ago, between the steps around it; null on no plate. */
export function placeThen(data: Impacts, impact: Impact, ma: number): GeoPoint | null {
  const at = ma / data.stepMa;
  const index = Math.floor(at);
  const younger = impact.then[index];
  if (younger === undefined || younger === null) return null;
  const older = impact.then[index + 1] ?? younger;
  const mix = at - index;
  // Across the antimeridian, the older longitude is taken the short way round.
  const turn = older[1] - younger[1] > 18000 ? -36000 : older[1] - younger[1] < -18000 ? 36000 : 0;
  const longitude = between(younger[1], older[1] + turn, mix) / data.scale;
  return {
    latitude: between(younger[0], older[0], mix) / data.scale,
    longitude: ((((longitude + 180) % 360) + 360) % 360) - 180,
  };
}

/**
 * How deep time shows the impacts: each around its time (`around`: from its youngest dated age
 * to its oldest, give or take `AROUND_MA`), or every one that may have struck by then (`struck`).
 */
export type ImpactsMode = 'around' | 'struck';
export const IMPACTS_MODES: readonly ImpactsMode[] = ['around', 'struck'];

/** How near its dated age a moment must be for an impact to show around its time, Ma. */
export const AROUND_MA = 2.5;
/** An impact dated only to a span wider than this, Ma, is marked as loosely dated. */
export const WIDE_SPAN_MA = 10;

/**
 * The impacts to mark `ma` million years ago, where each lay then (or at `placeMa`, for a map of
 * another moment), largest first: around their time, or every one that may have struck by then.
 * Today's Earth (`today`) shows every one, those whose age is given in words only too.
 */
export function impactsAt(
  data: Impacts,
  ma: number,
  today = false,
  placeMa = ma,
  mode: ImpactsMode = 'struck',
): readonly ImpactMark[] {
  const marks: ImpactMark[] = [];
  for (const impact of data.impacts) {
    const { olderMa, youngerMa } = impact;
    if (olderMa === null || youngerMa === null) {
      if (!today) continue;
    } else if (mode === 'around' && !today) {
      if (ma < youngerMa - AROUND_MA || ma > olderMa + AROUND_MA) continue;
    } else if (olderMa < ma) continue;
    const point = placeThen(data, impact, placeMa);
    if (point === null) continue;
    // Around its time, an impact is uncertain when dated only loosely; by then, when it may not
    // have struck yet.
    const uncertain =
      olderMa !== null &&
      youngerMa !== null &&
      (mode === 'around' && !today ? olderMa - youngerMa > WIDE_SPAN_MA : youngerMa < ma);
    marks.push({ impact, point, uncertain });
  }
  return marks.sort((a, b) => (b.impact.diameterKm ?? 0) - (a.impact.diameterKm ?? 0));
}

const KIND_NAMES: Readonly<Record<ImpactKind, string>> = {
  hypervelocity: 'Impact crater (shock metamorphism found)',
  crater: 'Impact crater (meteorite fragments found)',
  deposit: 'Impact deposit',
};

/** What the layer says of the impacts marked at a moment. */
export function impactsText(
  data: Impacts,
  marks: readonly ImpactMark[],
  ma: number | null,
  mode: ImpactsMode = 'struck',
): string {
  const left =
    data.leftOut.length === 0
      ? ''
      : ` ${String(data.leftOut.length)} left out: ${data.leftOut.map((out) => `${out.name}, ${out.why}`).join('; ')}.`;
  if (ma === null) {
    return `${String(marks.length)} impact craters and deposits, from the Impact Earth Database, where they are today. Tap one for its details.${left}`;
  }
  const sure = marks.filter((mark) => !mark.uncertain).length;
  const maybe = marks.length - sure;
  if (mode === 'around') {
    if (marks.length === 0) {
      return `No impacts dated to within ${String(AROUND_MA)} million years of ${formatMa(ma)}.`;
    }
    const loose =
      maybe === 0
        ? ''
        : `; ${String(maybe)} of them dated only to a span of more than ${String(WIDE_SPAN_MA)} million years (dashed)`;
    return `Impacts around ${formatMa(ma)}: ${String(marks.length)} whose dated age falls within ${String(AROUND_MA)} million years of then, each where it lay${loose}. Ages as the Impact Earth Database gives them.`;
  }
  const more =
    maybe === 0 ? '' : `, and ${String(maybe)} more may have (their ages span this moment)`;
  return `Impacts by ${formatMa(ma)}: ${String(sure)} had struck${more}, each where it lay then. Ages as the Impact Earth Database gives them.`;
}

/** A crater's or deposit's details, for its card. */
export interface ImpactDetails {
  readonly title: string;
  readonly facts: readonly (readonly [string, string])[];
  readonly link: { readonly label: string; readonly href: string };
}

export function impactDetails(impact: Impact): ImpactDetails {
  const where = [impact.region, impact.country].filter((part) => part !== '').join(', ');
  // Numbers alone are millions of years; words or a unit of its own are shown as they are.
  const inMa = /^[\d\s.,±<>≤~∼–-]+$/.test(impact.age);
  const age =
    impact.age === '' ? 'not given' : inMa ? `${impact.age} million years ago` : impact.age;
  return {
    title: impact.name,
    facts: [
      ['Kind', KIND_NAMES[impact.kind]],
      ...(where === '' ? [] : [['Where', where] as const]),
      ...(impact.diameterKm === null
        ? []
        : [['Diameter', `${impact.diameterKm.toLocaleString('en')} km`] as const]),
      ['Age', age],
      ...(impact.target === '' || impact.target === 'Not Applicable'
        ? []
        : [['Target rock', impact.target] as const]),
    ],
    link: {
      label: 'Impact Earth Database',
      href: `https://impact.uwo.ca/impact-craters/map/?crater_id=${String(impact.id)}`,
    },
  };
}
