/**
 * The International Chronostratigraphic Chart (`public/data/ics-chart.json`), from the ICS's
 * official machine-readable chart (CC BY 4.0) by the pipeline's `ics` command: every unit with
 * its rank, parent, ages and the chart's own colour. Bundled, as the periods name every moment
 * of deep time.
 */

import * as v from 'valibot';

import chartJson from '../../public/data/ics-chart.json' with { type: 'json' };
import { HEADER_ADDED } from '../data/header';

const Ma = v.pipe(v.number(), v.minValue(0));

const ChartSchema = v.strictObject({
  schemaVersion: v.literal(1),
  ...HEADER_ADDED,
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.url()),
  version: v.pipe(v.string(), v.minLength(1)),
  units: v.array(
    v.strictObject({
      id: v.pipe(v.string(), v.minLength(1)),
      name: v.pipe(v.string(), v.minLength(1)),
      rank: v.picklist(['Super-Eon', 'Eon', 'Era', 'Period', 'Sub-Period', 'Epoch', 'Age']),
      parent: v.nullable(v.string()),
      base: Ma,
      baseMargin: Ma,
      baseUncertain: v.boolean(),
      top: Ma,
      colour: v.pipe(v.string(), v.regex(/^#[0-9A-Fa-f]{6}$/)),
    }),
  ),
});

export type Chart = v.InferOutput<typeof ChartSchema>;
type ChartUnit = Chart['units'][number];

export const CHART: Chart = v.parse(ChartSchema, chartJson);

/** A unit drawn along the slider: where it starts and how wide it is, as shares of the span. */
export interface Band {
  readonly unit: ChartUnit;
  readonly left: number;
  readonly width: number;
}

/** The ice ages' divisions: the Pleistocene's ages and the Holocene. */
/** The Holocene's three ages: the bands over the years, its own span. */
const HOLOCENE_AGES = new Set(['Greenlandian', 'Northgrippian', 'Meghalayan']);

const QUATERNARY_PARTS = new Set([
  'Gelasian',
  'Calabrian',
  'Chibanian',
  'UpperPleistocene',
  'Holocene',
]);

/** The ranks a part of the Phanerozoic is divided by, coarsest first: the zoom's ladder (#1075). */
const LADDER: readonly ChartUnit['rank'][] = ['Period', 'Epoch', 'Age'];

/** Earth's whole history is drawn by its eras, and the Hadean, which has none. */
const isEra = (unit: ChartUnit): boolean =>
  unit.rank === 'Era' || (unit.rank === 'Eon' && unit.id === 'Hadean');

/**
 * The units that divide the bar from `oldest` to `youngest` Ma: the Holocene's ages over its own
 * years, the Quaternary's divisions over the ice ages, the eras over more than 600 million
 * years; else the coarsest rank of the ladder that divides the bar (#1075), so a zoom into the
 * Cretaceous shows its epochs, and into the Late Cretaceous its ages. Where the ladder has
 * nothing (the Archean has only eras), the eras.
 */
function unitsFor(oldest: number, youngest: number, chart: Chart): readonly ChartUnit[] {
  if (oldest <= 0.012) return chart.units.filter((unit) => HOLOCENE_AGES.has(unit.id));
  if (oldest <= 3) return chart.units.filter((unit) => QUATERNARY_PARTS.has(unit.id));
  const eras = chart.units.filter(isEra);
  if (oldest - youngest > 600) return eras;
  let finest: readonly ChartUnit[] = [];
  for (const rank of LADDER) {
    const units = chart.units.filter(
      (unit) => unit.rank === rank && unit.top < oldest && unit.base > youngest,
    );
    if (units.length >= 2) return units;
    if (units.length > 0) finest = units;
  }
  return finest.length > 0 ? finest : eras;
}

/**
 * The units to draw along a slider from `oldest` million years ago to `youngest` (the present,
 * unless the bar shows a part of the span, #1074), as `unitsFor` picks them. Oldest first,
 * clipped to the bar.
 */
export function bandsFor(oldest: number, chart: Chart = CHART, youngest = 0): readonly Band[] {
  const units = unitsFor(oldest, youngest, chart);
  // Cut to the part of time the bar shows, `oldest` to `youngest` (#1074).
  const length = oldest - youngest;
  return units
    .filter((unit) => unit.top < oldest && unit.base > youngest)
    .map((unit) => {
      const base = Math.min(unit.base, oldest);
      const top = Math.max(unit.top, youngest);
      return { unit, left: (oldest - base) / length, width: (base - top) / length };
    })
    .sort((a, b) => a.left - b.left);
}

/**
 * Where a part of deep time lies (#1075): the units that hold all of it, widest first, from
 * the eon down to the narrowest (Phanerozoic, Mesozoic, Cretaceous for 124 to 76 Ma). None
 * where no one unit holds it, as for the 540 Myr span.
 */
export function crumbsFor(oldest: number, youngest: number, chart: Chart = CHART): ChartUnit[] {
  return chart.units
    .filter(
      (unit) =>
        unit.rank !== 'Super-Eon' &&
        unit.rank !== 'Sub-Period' &&
        unit.base >= oldest &&
        unit.top <= youngest,
    )
    .sort((a, b) => b.base - b.top - (a.base - a.top));
}
