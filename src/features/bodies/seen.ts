/**
 * What the bodies part (#449) says of a body, worked out without the page: a planet as an
 * observer sees it, and a view's colour key for the bar.
 */

import type { Vector3 } from '../../astro/matrix';
import { planetMagnitude, saturnRingTilt, type PlanetName } from '../../astro/planets';
import { keyGradient, keyTicks, type loadColourKeys } from '../../data/planetKeys';
import type { PlanetView } from '../../globe/planetLook';
import { topocentric } from '../../sky/bodies';
import type { SkyPlanet } from '../../sky/skyScene';
import type { BodyKey } from '../../ui/bodyBar';

const KM_PER_AU = 149_597_870.7;

/** The colour keys as loaded: the heights' and the rocks'. */
export type LoadedKeys = Awaited<ReturnType<typeof loadColourKeys>>;

/** A planet as seen: its name, its direction from the observer, and how bright it is. */
export function seenPlanet(
  planet: PlanetName,
  fromEarth: Vector3,
  sun: Vector3,
  observer: Vector3,
): SkyPlanet {
  const [x, y, z] = fromEarth;
  const [sx, sy, sz] = [sun[0] - x, sun[1] - y, sun[2] - z];
  const delta = Math.hypot(x, y, z);
  const r = Math.hypot(sx, sy, sz);
  // Phase angle: at the planet, between the Sun and Earth.
  const cosine = -(sx * x + sy * y + sz * z) / (r * delta);
  const phase = (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI;
  return {
    name: `${planet.charAt(0).toUpperCase()}${planet.slice(1)}`,
    direction: topocentric(fromEarth, observer),
    magnitude: planetMagnitude(
      planet,
      r / KM_PER_AU,
      delta / KM_PER_AU,
      phase,
      planet === 'saturn' ? saturnRingTilt(fromEarth) : 0,
    ),
  };
}

/** A view's colour key for the bar: its rocks' swatches, or its heights' gradient; or none. */
export function viewKey(
  keys: LoadedKeys,
  { colourKey, rockKey }: Pick<PlanetView, 'colourKey' | 'rockKey'>,
): { key?: BodyKey } {
  if (rockKey !== undefined) {
    const { swatches, credit } = keys.rocks[rockKey];
    return { key: { swatches, note: `${credit.charAt(0).toUpperCase()}${credit.slice(1)}.` } };
  }
  if (colourKey === undefined) return {};
  const key = keys.heights[colourKey];
  return {
    key: {
      gradient: keyGradient(key),
      ticks: keyTicks(key),
      note: `Height ${key.datum}; key ${key.credit}.`,
    },
  };
}
