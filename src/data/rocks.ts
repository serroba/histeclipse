/**
 * The rocks at Earth's surface today and how old they are (`public/data/rocks.json`), from
 * Macrostrat's world geologic map (Peters et al., CC BY 4.0) by the pipeline's `rocks` command:
 * each map unit's outline, name, rock type, best age range (millions of years) and colour.
 */

import * as v from 'valibot';

import type { GeoPoint } from '../core/geo';
import { insideWrapped, ringsOf, type Ring } from '../util/polygons';
import { getJson, type Fetch } from '../util/fetchJson';

const Ma = v.pipe(v.number(), v.minValue(0));

const RocksSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.url()),
  accessed: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
  scale: v.pipe(v.number(), v.gtValue(0)),
  units: v.array(
    v.strictObject({
      name: v.string(),
      lith: v.string(),
      topMa: Ma,
      bottomMa: Ma,
      colour: v.pipe(v.string(), v.regex(/^#[0-9A-Fa-f]{6}$/)),
      rings: v.array(v.array(v.pipe(v.number(), v.integer()))),
    }),
  ),
});

export type Rocks = v.InferOutput<typeof RocksSchema>;

export async function loadRocks(url: string, fetchJson: Fetch): Promise<Rocks> {
  return getJson(fetchJson, url, RocksSchema);
}

/** A map unit in degrees. */
export interface RockUnit {
  readonly name: string;
  readonly lith: string;
  readonly topMa: number;
  readonly bottomMa: number;
  readonly colour: string;
  readonly rings: readonly Ring[];
}

/** Every unit, its rings in degrees. */
export function rockUnits(data: Rocks): readonly RockUnit[] {
  return data.units.map((unit) => ({
    ...unit,
    rings: ringsOf(unit.rings, data.scale),
  }));
}

/** The unit at a place, if the map has one there; rings may run past ±180°. */
export function rockAt(units: readonly RockUnit[], place: GeoPoint): RockUnit | null {
  for (const unit of units) {
    if (insideWrapped(unit.rings, place.longitude, place.latitude)) return unit;
  }
  return null;
}

/** An age in millions of years, as the bar writes it: "485.4", "2,500", "0.01". */
function ma(value: number): string {
  return value.toLocaleString('en', { maximumFractionDigits: value < 10 ? 2 : 1 });
}

/** What the Layers panel says of the rock at the place picked. */
export function rockText(unit: RockUnit | null): string {
  if (unit === null) return 'Pick a place on the globe to see its rock; this map has none there.';
  const what =
    unit.lith === '' || unit.name.includes(unit.lith) ? unit.name : `${unit.name} (${unit.lith})`;
  return `At the place picked: ${what}, formed ${ma(unit.bottomMa)}–${ma(unit.topMa)} million years ago.`;
}
