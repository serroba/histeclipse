/**
 * The Moon's and the planets' theories, each answer kept for the last few moments asked (#766).
 * Within a frame, the moment shown asks where the Moon and the planets are, and so do the craft
 * at them, at the same moment: one series summed, not two. A few moments are kept, so a frame
 * that also asks of another moment (a trail, a search) does not push out the one shown.
 */

import type { EquatorialVector, MoonEphemeris } from './moon';
import type { PlanetEphemeris } from './planets';

/** Moments kept, per body. */
const KEPT = 4;

/** `compute` remembered for the last `most` keys asked, oldest let go first. */
function keptLast<K, V>(compute: (key: K) => V, most: number): (key: K) => V {
  const kept = new Map<K, V>();
  return (key) => {
    const known = kept.get(key);
    if (known !== undefined) return known;
    const value = compute(key);
    kept.set(key, value);
    const [oldest] = kept.keys();
    if (kept.size > most && oldest !== undefined) kept.delete(oldest);
    return value;
  };
}

/** The Moon's theory, its last few moments kept. */
export function keptMoon(exact: MoonEphemeris): MoonEphemeris {
  const position = keptLast(
    (jdTT: Parameters<MoonEphemeris['position']>[0]) => exact.position(jdTT),
    KEPT,
  );
  return { position };
}

/** The planets' theory, each planet's last few moments kept; seen and heliocentric as they are. */
export function keptPlanets(exact: PlanetEphemeris): PlanetEphemeris {
  const each = new Map<string, (jdTT: number) => EquatorialVector>();
  return {
    position(planet, jdTT) {
      let kept = each.get(planet);
      if (kept === undefined) {
        kept = keptLast((jd: number) => exact.position(planet, jd as typeof jdTT), KEPT);
        each.set(planet, kept);
      }
      return kept(jdTT);
    },
    apparent: (planet, jdTT) => exact.apparent(planet, jdTT),
    heliocentric: (body, jdTT) => exact.heliocentric(body, jdTT),
  };
}
