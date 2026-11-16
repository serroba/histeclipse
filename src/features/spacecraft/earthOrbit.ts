/**
 * A craft that stays in orbit about Earth (#795), the Hubble Space Telescope the first: where it
 * is drawn at a moment. The record gives how high its orbit was when first measured and how far
 * it is tilted to the equator, and no more, so the path is a circle at the middle of those
 * heights, tilted so, gone round at the pace such a circle is, its plane swinging westward as
 * Earth's bulge pulls on it. The height and the tilt are the craft's; where it is along the
 * circle, and which way the circle faces, are not, and it is drawn as approximate. Its height
 * has changed since (it sinks through the thin air, and has been lifted), which the circle does
 * not follow.
 */

import { GM_EARTH, type Vec3 } from '../../astro/transfer';

/** An orbit about Earth as GCAT gives it: its lowest and highest above the ground, its tilt. */
export interface EarthOrbit {
  readonly perigeeKm: number;
  readonly apogeeKm: number;
  readonly inclinationDeg: number;
}

/** Earth's radius at the equator, km, from which heights are counted; its bulge (J2). */
const EQUATOR_KM = 6378.137;
const J2 = 1.082_626_68e-3;
const J2000 = 2_451_545;
const DAY_SECONDS = 86_400;
const TURN = 2 * Math.PI;

/** The circle's radius from Earth's centre, km: the middle of its lowest and highest. */
export function orbitRadiusKm(orbit: EarthOrbit): number {
  return EQUATOR_KM + (orbit.perigeeKm + orbit.apogeeKm) / 2;
}

/** How fast it goes round, radians a second. */
function pace(orbit: EarthOrbit): number {
  return Math.sqrt(GM_EARTH / orbitRadiusKm(orbit) ** 3);
}

/** Once round, in days. */
export function lapDays(orbit: EarthOrbit): number {
  return TURN / pace(orbit) / DAY_SECONDS;
}

/** How fast its plane swings round Earth's axis, degrees a day: westward for a prograde orbit. */
export function planeDriftDegPerDay(orbit: EarthOrbit): number {
  const tilt = (orbit.inclinationDeg * Math.PI) / 180;
  const perSecond =
    -1.5 * pace(orbit) * J2 * (EQUATOR_KM / orbitRadiusKm(orbit)) ** 2 * Math.cos(tilt);
  return (perSecond * DAY_SECONDS * 180) / Math.PI;
}

/**
 * Where the craft is on its circle at `jdTT`, from Earth's centre (J2000 equatorial km). At
 * J2000 it crosses the equator northward at the equinox: a start chosen, not measured.
 */
export function circling(orbit: EarthOrbit, jdTT: number): Vec3 {
  const days = jdTT - J2000;
  const radius = orbitRadiusKm(orbit);
  const tilt = (orbit.inclinationDeg * Math.PI) / 180;
  const along = ((days / lapDays(orbit)) % 1) * TURN;
  const node = (((planeDriftDegPerDay(orbit) * days) % 360) * Math.PI) / 180;
  const x = Math.cos(along);
  const y = Math.sin(along) * Math.cos(tilt);
  return [
    radius * (x * Math.cos(node) - y * Math.sin(node)),
    radius * (x * Math.sin(node) + y * Math.cos(node)),
    radius * Math.sin(along) * Math.sin(tilt),
  ];
}
