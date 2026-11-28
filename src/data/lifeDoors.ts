/**
 * The doors between the continents (`public/data/life-stories/doors.json`), by the pipeline's
 * `life_doors` (a prototype): for each pair of today's lands that ever touched, whether land
 * joined them, a shallow sea lay between, or they stood apart, every 5 million years, as read
 * from the PALEOMAP elevation maps the deep-time globe draws (Scotese & Wright 2018).
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';

/** How a door stands: sea between, a shallow sea between, or joined by land. */
export const APART = 0;
export const SHELF = 1;
export const LAND = 2;
export type DoorState = typeof APART | typeof SHELF | typeof LAND;

const Index = v.pipe(v.number(), v.integer(), v.minValue(0));

const DoorsSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    credit: v.pipe(v.string(), v.minLength(1)),
    source: v.pipe(v.string(), v.url()),
    accessed: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
    stepMa: v.pipe(v.number(), v.gtValue(0)),
    /** The lands a door joins: the stories' regions in their order, then India on its own. */
    lands: v.pipe(v.array(v.string()), v.minLength(2)),
    /** The moments the doors are read at, Ma, youngest first. */
    steps: v.pipe(v.array(v.pipe(v.number(), v.minValue(0))), v.minLength(1)),
    /** How deep a shallow sea may be, metres. */
    shelfMetres: v.pipe(v.number(), v.gtValue(0)),
    doors: v.array(
      v.strictObject({
        a: Index,
        b: Index,
        states: v.array(v.picklist([APART, SHELF, LAND])),
      }),
    ),
  }),
  v.check(
    (file) =>
      file.doors.every(
        (door) =>
          door.a < door.b && door.b < file.lands.length && door.states.length === file.steps.length,
      ),
    'each door joins two of the lands and has a state for each step',
  ),
);

export type LifeDoors = v.InferOutput<typeof DoorsSchema>;
export type Door = LifeDoors['doors'][number];

export async function loadLifeDoors(url: string, fetchJson: Fetch): Promise<LifeDoors> {
  return getJson(fetchJson, url, DoorsSchema);
}

/** How a door stood at a moment: at the step nearest it; apart beyond the steps. */
export function doorAt(doors: LifeDoors, door: Door, ma: number): DoorState {
  const at = doors.steps.indexOf(Math.round(ma / doors.stepMa) * doors.stepMa);
  return at < 0 ? APART : (door.states[at] ?? APART);
}
