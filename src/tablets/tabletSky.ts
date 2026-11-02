/**
 * The sky a Babylonian observer saw, for checking what tablets record: where the Moon and the
 * planets stood against the stars, and when the Sun and Moon rose and set.
 *
 * Babylonian astronomers measured along the zodiac: a body "in front of" a star is west of it
 * (ahead in the daily turning of the sky), "behind" is east, "above" and "below" north and south.
 * Here those are ecliptic longitude and latitude differences, of date, with the Moon seen from
 * Babylon (its parallax is up to a degree, half a cubit). A cubit is taken as 2.2° and has 24
 * fingers (Neugebauer; Hunger), though tablets suggest it varied between about 2° and 2.5°.
 *
 * The "lunar six" are time intervals around sunrise and sunset, in UŠ (time degrees: 1 UŠ is
 * 4 minutes): NA, from sunset to moonset on the first evening and from sunrise to moonset after
 * full moon; KUR, from moonrise to sunrise on the last morning; ŠÚ, ME and GE₆ around full moon.
 */

import { eclipticPole, equatorPole, longTermEarthFixedToJ2000 } from '../astro/longTermPrecession';
import { apply, type Vector3 } from '../astro/matrix';
import type { MoonEphemeris } from '../astro/moon';
import type { PlanetEphemeris, PlanetName } from '../astro/planets';
import { sunPositionJ2000 } from '../astro/precession';
import { starDirection, type StarMotion } from '../astro/stars';
import { observerPosition, topocentric } from '../sky/bodies';
import { horizonMatrix } from '../sky/horizon';
import type { GeoPoint } from '../state/viewState';
import { julianDayNumber, type JulianDay } from '../time/julianDay';
import { elementAt } from '../util/arrays';

/** Babylon, the ruins by Hillah. */
export const BABYLON: GeoPoint = { latitude: 32.5355, longitude: 44.4275 };
export const DEGREES_PER_CUBIT = 2.2;
export const FINGERS_PER_CUBIT = 24;
/** Minutes of time in one UŠ. */
export const MINUTES_PER_US = 4;
/** Where the Sun's and the Moon's upper limbs touch the horizon, refraction allowed for. */
const RISING_ALTITUDE = -0.8333;
const RADIANS = Math.PI / 180;
const SECONDS_PER_DAY = 86_400;

export type Body = 'sun' | 'moon' | PlanetName | { readonly star: number };

export interface TabletSky {
  readonly moon: MoonEphemeris;
  readonly planets: PlanetEphemeris;
  /** Stars by their Bright Star Catalogue (HR) number. */
  readonly stars: ReadonlyMap<number, StarMotion>;
  /** ΔT in seconds at a moment. */
  deltaT(jd: JulianDay): number;
  readonly place: GeoPoint;
}

function unit([x, y, z]: Vector3): Vector3 {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

function terrestrial(sky: TabletSky, jdUT: JulianDay): JulianDay {
  return julianDayNumber(jdUT + sky.deltaT(jdUT) / SECONDS_PER_DAY);
}

/** Where a body is seen from the observer, as a J2000 unit vector. */
export function directionOf(sky: TabletSky, body: Body, jdUT: JulianDay): Vector3 {
  const jdTT = terrestrial(sky, jdUT);
  if (typeof body === 'object') {
    const star = sky.stars.get(body.star);
    if (star === undefined)
      throw new RangeError(`No star HR ${String(body.star)} in the catalogue`);
    return starDirection(star, jdTT);
  }
  if (body === 'moon' || body === 'sun') {
    const observer = observerPosition(sky.place, longTermEarthFixedToJ2000(jdUT, jdTT));
    const position = body === 'moon' ? sky.moon.position(jdTT) : sunPositionJ2000(jdTT);
    return unit(topocentric(position, observer));
  }
  return unit(sky.planets.apparent(body, jdTT));
}

function dot(a: Vector3, b: Vector3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vector3, b: Vector3): Vector3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export interface Offset {
  /** Degrees east along the ecliptic of date: positive is "behind", negative "in front of". */
  readonly along: number;
  /** Degrees north of it: positive is "above", negative "below". */
  readonly across: number;
}

/** Where `body` stands from `reference`, along and across the ecliptic of date. */
export function offsetBetween(
  sky: TabletSky,
  body: Body,
  reference: Body,
  jdUT: JulianDay,
): Offset {
  const jdTT = terrestrial(sky, jdUT);
  const pole = eclipticPole(jdTT);
  // The equinox of date: where the equator and the ecliptic cross.
  const equinox = unit(cross(equatorPole(jdTT), pole));
  const quarter = cross(pole, equinox);
  const longitude = (direction: Vector3) =>
    Math.atan2(dot(direction, quarter), dot(direction, equinox)) / RADIANS;
  const latitude = (direction: Vector3) => Math.asin(dot(direction, pole)) / RADIANS;
  const a = directionOf(sky, body, jdUT);
  const b = directionOf(sky, reference, jdUT);
  const along = ((longitude(a) - longitude(b) + 540) % 360) - 180;
  return { along, across: latitude(a) - latitude(b) };
}

/** Altitude (degrees) of the Sun or Moon's centre above the observer's horizon. */
export function altitudeOf(sky: TabletSky, body: 'sun' | 'moon', jdUT: JulianDay): number {
  const jdTT = terrestrial(sky, jdUT);
  const [, , up] = apply(horizonMatrix(sky.place, jdUT, jdTT), directionOf(sky, body, jdUT));
  return Math.asin(up) / RADIANS;
}

export type Crossing = 'rise' | 'set';

/**
 * When the Sun or Moon next rises or sets after `fromUT`, within `withinDays`: the moment its
 * upper limb touches the horizon. Null if it does not.
 */
export function nextCrossing(
  sky: TabletSky,
  body: 'sun' | 'moon',
  crossing: Crossing,
  fromUT: JulianDay,
  withinDays = 1.1,
): JulianDay | null {
  const step = 10 / 1440;
  const above = (jd: number) => altitudeOf(sky, body, julianDayNumber(jd)) > RISING_ALTITUDE;
  let before = fromUT as number;
  let wasAbove = above(before);
  for (let jd = before + step; jd <= fromUT + withinDays; jd += step) {
    const isAbove = above(jd);
    if (isAbove !== wasAbove && isAbove === (crossing === 'rise')) {
      let low = before;
      let high = jd;
      for (let pass = 0; pass < 20; pass++) {
        const middle = (low + high) / 2;
        if (above(middle) === wasAbove) low = middle;
        else high = middle;
      }
      return julianDayNumber((low + high) / 2);
    }
    before = jd;
    wasAbove = isAbove;
  }
  return null;
}

/** Local midnight beginning a civil date (a fixed day), as a UT Julian Day at the observer. */
export function localMidnight(sky: TabletSky, fixedDay: number): JulianDay {
  return julianDayNumber(fixedDay + 1_721_424.5 - sky.place.longitude / 360);
}

/** Sunset on a civil date (fixed day) at the observer, or null in polar day or night. */
export function sunsetOn(sky: TabletSky, fixedDay: number): JulianDay | null {
  return nextCrossing(sky, 'sun', 'set', julianDayNumber(localMidnight(sky, fixedDay) + 0.5), 0.5);
}

/** Sunrise on a civil date (fixed day) at the observer. */
export function sunriseOn(sky: TabletSky, fixedDay: number): JulianDay | null {
  return nextCrossing(sky, 'sun', 'rise', localMidnight(sky, fixedDay), 0.5);
}

export type LunarSix = 'NA first' | 'NA' | 'SU' | 'ME' | 'GE6' | 'KUR';

/**
 * A lunar-six interval in UŠ on a civil date (fixed day): for "NA first", "ME" and "GE₆" that
 * evening, for "NA", "ŠÚ" and "KUR" that morning. Null when the events do not happen in order.
 */
export function lunarSix(sky: TabletSky, kind: LunarSix, fixedDay: number): number | null {
  const evening = kind === 'NA first' || kind === 'ME' || kind === 'GE6';
  const sunEvent = evening ? sunsetOn(sky, fixedDay) : sunriseOn(sky, fixedDay);
  if (sunEvent === null) return null;
  const searchFrom = julianDayNumber(sunEvent - 0.5);
  let start: JulianDay | null;
  let end: JulianDay | null;
  switch (kind) {
    case 'NA first':
    case 'NA':
      start = sunEvent;
      end = nextCrossing(sky, 'moon', 'set', sunEvent, 0.5);
      break;
    case 'SU':
      start = nextCrossing(sky, 'moon', 'set', searchFrom, 0.5);
      end = sunEvent;
      break;
    case 'ME':
      start = nextCrossing(sky, 'moon', 'rise', searchFrom, 0.5);
      end = sunEvent;
      break;
    case 'GE6':
      start = sunEvent;
      end = nextCrossing(sky, 'moon', 'rise', sunEvent, 0.5);
      break;
    case 'KUR':
      start = nextCrossing(sky, 'moon', 'rise', searchFrom, 0.5);
      end = sunEvent;
      break;
  }
  if (start === null || end === null || end < start) return null;
  return ((end - start) * 1440) / MINUTES_PER_US;
}

/** The catalogue's stars by HR number, for `TabletSky`. */
export function starsByNumber(stars: {
  readonly hr: readonly number[];
  readonly ra: readonly number[];
  readonly dec: readonly number[];
  readonly pmRa: readonly number[];
  readonly pmDec: readonly number[];
  readonly parallax: readonly (number | null)[];
  readonly radialVelocity: readonly (number | null)[];
}): ReadonlyMap<number, StarMotion> {
  return new Map(
    stars.hr.map((hr, index) => [
      hr,
      {
        ra: elementAt(stars.ra, index),
        dec: elementAt(stars.dec, index),
        pmRa: elementAt(stars.pmRa, index),
        pmDec: elementAt(stars.pmDec, index),
        parallax: elementAt(stars.parallax, index),
        radialVelocity: elementAt(stars.radialVelocity, index),
      },
    ]),
  );
}
