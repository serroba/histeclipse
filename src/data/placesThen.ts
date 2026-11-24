/**
 * A place carried back through time in steps (#380, #1190): its latitude and longitude, × a
 * scale, every `stepMa` back from today on the PALEOMAP reconstruction, as the pipeline writes
 * the impact craters' and the extinctions' places. Pure.
 */

import type { GeoPoint } from '../core/geo';

/** A place at each step back from today, latitude and longitude × scale; null on no plate. */
export type StepsThen = readonly (readonly [number, number] | null)[];

function between(a: number, b: number, mix: number): number {
  return a + (b - a) * mix;
}

/** Where a place lay `ma` million years ago, between the steps around it; null on no plate. */
export function pointThen(
  then: StepsThen,
  steps: { readonly stepMa: number; readonly scale: number },
  ma: number,
): GeoPoint | null {
  const at = ma / steps.stepMa;
  const index = Math.floor(at);
  const younger = then[index];
  if (younger === undefined || younger === null) return null;
  const older = then[index + 1] ?? younger;
  const mix = at - index;
  // Across the antimeridian, the older longitude is taken the short way round.
  const turn = older[1] - younger[1] > 18000 ? -36000 : older[1] - younger[1] < -18000 ? 36000 : 0;
  const longitude = between(younger[1], older[1] + turn, mix) / steps.scale;
  return {
    latitude: between(younger[0], older[0], mix) / steps.scale,
    longitude: ((((longitude + 180) % 360) + 360) % 360) - 180,
  };
}
