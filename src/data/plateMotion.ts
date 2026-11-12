/**
 * How far the main plates have moved through the ice ages (`public/data/plates-motion.json`),
 * from Cao et al.'s (2024) plate model (CC BY 4.0) by the plates pipeline's `motion` command: a
 * point on each plate carried back every 50,000 years over 2.6 million, its distance (km) and
 * bearing (°) from then to today, in the model's paleomagnetic frame (relative to Earth's spin
 * axis).
 */

import * as v from 'valibot';

import { elementAt } from '../util/arrays';
import { getJson, type Fetch } from '../util/fetchJson';

const MotionSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.url()),
  frame: v.literal('paleomagnetic'),
  stepMa: v.pipe(v.number(), v.gtValue(0)),
  plates: v.array(
    v.strictObject({
      name: v.pipe(v.string(), v.minLength(1)),
      latitude: v.number(),
      longitude: v.number(),
      /** Each step back: distance (km) and bearing (°) from then to today. */
      moved: v.pipe(
        v.array(
          v.tuple([
            v.pipe(v.number(), v.minValue(0)),
            v.pipe(v.number(), v.minValue(0), v.maxValue(360)),
          ]),
        ),
        v.minLength(2),
      ),
    }),
  ),
});

export type PlateMotion = v.InferOutput<typeof MotionSchema>;

export async function loadPlateMotion(url: string, fetchJson: Fetch): Promise<PlateMotion> {
  return getJson(fetchJson, url, MotionSchema);
}

const COMPASS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
];

/** A bearing as one of eight compass directions. */
export function compass(degrees: number): string {
  return elementAt(COMPASS, Math.round((((degrees % 360) + 360) % 360) / 45) % 8);
}

/**
 * Each plate's move from `ma` million years ago to today: the distance between the steps either
 * side, and the bearing of the nearer; null for a plate beyond the record.
 */
export function motionSince(
  data: PlateMotion,
  ma: number,
): readonly { readonly name: string; readonly km: number; readonly bearing: number }[] {
  const at = Math.max(0, ma) / data.stepMa;
  return data.plates.flatMap((plate) => {
    const last = plate.moved.length - 1;
    if (at > last) return [];
    const lower = Math.floor(at);
    const upper = Math.min(last, lower + 1);
    const [nearKm, nearBearing] = elementAt(plate.moved, lower);
    const [farKm, farBearing] = elementAt(plate.moved, upper);
    const share = at - lower;
    return [
      {
        name: plate.name,
        km: nearKm + share * (farKm - nearKm),
        bearing: share < 0.5 ? nearBearing : farBearing,
      },
    ];
  });
}

/** What the ice-age note says of how far the plates have moved since the moment shown. */
export function motionText(data: PlateMotion, ma: number): string | null {
  const moves = motionSince(data, ma).filter((move) => Math.round(move.km) >= 1);
  if (moves.length === 0) return null;
  const list = moves
    .map((move) => `${move.name} ${String(Math.round(move.km))} km ${compass(move.bearing)}`)
    .join(', ');
  return `Since then the plates have moved, relative to Earth’s spin axis in Cao et al.’s (2024) model: ${list}. Too little to see on the whole globe; the map is today’s.`;
}
