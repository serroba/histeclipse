/**
 * A craft that stays in orbit about Earth (#795), the Hubble Space Telescope the first, and the
 * space telescopes there (#849): where it is drawn at a moment. The record gives its orbit's
 * lowest and highest points when first measured, and its tilt to the equator, and no more. So the
 * path is the ellipse those make (a near-circle for Hubble, a long ellipse a third of the way to
 * the Moon for Chandra), tilted so, gone round at its own pace and faster near Earth, as Kepler's
 * second law has it, its plane swinging westward as Earth's bulge pulls on it. The heights, the
 * tilt and the pace are the craft's; where it is along the ellipse, which way the ellipse faces
 * and where in it the lowest point lies are not, and it is drawn as approximate. Its orbit has
 * changed since (a low one sinks through the thin air, and Hubble has been lifted), which the
 * ellipse does not follow.
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

/** Its size from Earth's centre, km: half its longest width, the middle of its lowest and highest. */
export function orbitRadiusKm(orbit: EarthOrbit): number {
  return EQUATOR_KM + (orbit.perigeeKm + orbit.apogeeKm) / 2;
}

/** How long and thin it is: 0 for a circle, toward 1 for a long ellipse. */
export function eccentricity(orbit: EarthOrbit): number {
  const nearest = EQUATOR_KM + orbit.perigeeKm;
  const farthest = EQUATOR_KM + orbit.apogeeKm;
  return (farthest - nearest) / (farthest + nearest);
}

/** How fast it goes round on average, radians a second. */
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
  // The ellipse's semi-latus rectum: the bulge pulls hardest on a craft that comes close.
  const latus = orbitRadiusKm(orbit) * (1 - eccentricity(orbit) ** 2);
  const perSecond = -1.5 * pace(orbit) * J2 * (EQUATOR_KM / latus) ** 2 * Math.cos(tilt);
  return (perSecond * DAY_SECONDS * 180) / Math.PI;
}

/** Kepler's equation, M = E − e sin E, solved for the eccentric anomaly E by Newton's method. */
export function eccentricAnomaly(mean: number, e: number): number {
  let anomaly = e < 0.8 ? mean : Math.PI;
  for (let step = 0; step < 30; step += 1) {
    const change = (anomaly - e * Math.sin(anomaly) - mean) / (1 - e * Math.cos(anomaly));
    anomaly -= change;
    if (Math.abs(change) < 1e-12) break;
  }
  return anomaly;
}

/**
 * Where the craft is on its ellipse at `jdTT`, from Earth's centre (J2000 equatorial km). At
 * J2000 it is at its lowest, over the equator at the equinox, heading north: a start chosen, not
 * measured.
 */
export function circling(orbit: EarthOrbit, jdTT: number): Vec3 {
  const days = jdTT - J2000;
  const size = orbitRadiusKm(orbit);
  const e = eccentricity(orbit);
  const tilt = (orbit.inclinationDeg * Math.PI) / 180;
  const mean = ((((days / lapDays(orbit)) % 1) + 1) % 1) * TURN;
  const anomaly = eccentricAnomaly(mean, e);
  // In the orbit's own plane, its lowest point along x.
  const inX = size * (Math.cos(anomaly) - e);
  const inY = size * Math.sqrt(1 - e * e) * Math.sin(anomaly);
  const node = (((planeDriftDegPerDay(orbit) * days) % 360) * Math.PI) / 180;
  const y = inY * Math.cos(tilt);
  return [
    inX * Math.cos(node) - y * Math.sin(node),
    inX * Math.sin(node) + y * Math.cos(node),
    inY * Math.sin(tilt),
  ];
}

/**
 * The moments of the lap just made, newest first, `count` of them from `jdTT` back a lap, spaced
 * evenly round the ellipse rather than in time (#849): a long ellipse passes its lowest point
 * fast, and evenly timed points would leave that bend in a few straight strokes.
 */
export function lapMoments(orbit: EarthOrbit, jdTT: number, count: number): number[] {
  const lap = lapDays(orbit);
  const e = eccentricity(orbit);
  const turns = (jdTT - J2000) / lap;
  const meanNow = (turns - Math.floor(turns)) * TURN;
  const anomalyNow = eccentricAnomaly(meanNow, e);
  return Array.from({ length: count }, (_, step) => {
    const anomaly = anomalyNow - (TURN * step) / (count - 1);
    const mean = anomaly - e * Math.sin(anomaly);
    return jdTT - ((meanNow - mean) / TURN) * lap;
  });
}
