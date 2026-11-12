/**
 * The International Chronostratigraphic Chart (`public/data/ics-chart.json`), from the ICS's
 * official machine-readable chart (CC BY 4.0) by the pipeline's `ics` command: every unit with
 * its rank, parent, ages and the chart's own colour. Bundled, as the periods name every moment
 * of deep time.
 */

import * as v from 'valibot';

import chartJson from '../../public/data/ics-chart.json';

const Ma = v.pipe(v.number(), v.minValue(0));

const ChartSchema = v.strictObject({
  schemaVersion: v.literal(1),
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

/**
 * The units to draw along a slider from `oldest` million years ago to the present: the
 * Holocene's ages over its own years, the Quaternary's divisions over the ice ages, the periods over the Phanerozoic, the eras over
 * Earth's whole history. Oldest first, clipped to the span.
 */
export function bandsFor(oldest: number, chart: Chart = CHART): readonly Band[] {
  const units = chart.units.filter((unit) =>
    oldest <= 0.012
      ? HOLOCENE_AGES.has(unit.id)
      : oldest <= 3
        ? QUATERNARY_PARTS.has(unit.id)
        : oldest <= 600
          ? unit.rank === 'Period'
          : unit.rank === 'Era' || (unit.rank === 'Eon' && unit.id === 'Hadean'),
  );
  return units
    .filter((unit) => unit.top < oldest)
    .map((unit) => {
      const base = Math.min(unit.base, oldest);
      return { unit, left: 1 - base / oldest, width: (base - unit.top) / oldest };
    })
    .sort((a, b) => a.left - b.left);
}
