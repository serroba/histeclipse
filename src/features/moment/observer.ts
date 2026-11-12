/**
 * Where the reader stands to see the moment (#451): the place picked, or the middle of the
 * globe in view; what that place is called; and the Sun and the Moon from there. Pure.
 */

import type { MoonEphemeris } from '../../astro/moon';
import { sunPositionJ2000 } from '../../astro/precession';
import type { FamousEclipse } from '../../data/famousEclipses';
import { CULTURE_INFO } from '../../data/skyCultures';
import { longTermEarthFixedToJ2000 } from '../../astro/longTermPrecession';
import type { BodiesSeen } from '../../sky/aim';
import { observerPosition } from '../../sky/bodies';
import {
  DEFAULT_CAMERA,
  momentJulianDay,
  type GeoPoint,
  type ViewState,
} from '../../state/viewState';
import type { JulianDay } from '../../time/julianDay';

/** Where the observer stands: the place picked, or the middle of Earth in view. */
export function observerOf(state: ViewState): GeoPoint {
  if (state.location !== null) return state.location;
  return state.focus === 'earth' ? state.camera.target : DEFAULT_CAMERA.target;
}

/** The name of a culture's observing site, if the observer stands right there. */
export function namedPlace(place: GeoPoint): string | null {
  const site = Object.values(CULTURE_INFO).find(
    (info) =>
      info.place !== null &&
      Math.abs(info.place.latitude - place.latitude) < 0.01 &&
      Math.abs(info.place.longitude - place.longitude) < 0.01,
  );
  return site?.place?.name ?? null;
}

/** The name of where the observer stands: a famous eclipse's place, or a culture's site. */
export function placeName(place: GeoPoint, famousHere: FamousEclipse | undefined): string | null {
  const record = famousHere?.place;
  if (
    record !== undefined &&
    Math.abs(record.latitude - place.latitude) < 0.01 &&
    Math.abs(record.longitude - place.longitude) < 0.01
  ) {
    return record.name;
  }
  return namedPlace(place);
}

/**
 * Where the Sun and the Moon stand, from Earth's centre and from the observer, in km; null when
 * the moment is beyond ΔT's reach.
 */
export function bodiesSeen(
  state: ViewState,
  terrestrialTime: (jdUT: JulianDay) => JulianDay,
  moon: MoonEphemeris | null,
): BodiesSeen | null {
  const place = observerOf(state);
  const jdUT = momentJulianDay(state.time);
  let jdTT;
  try {
    jdTT = terrestrialTime(jdUT);
  } catch {
    return null; // The moment shown has already said so and moved to today.
  }
  return {
    place,
    jdUT,
    jdTT,
    observer: observerPosition(place, longTermEarthFixedToJ2000(jdUT, jdTT)),
    sun: sunPositionJ2000(jdTT),
    moon: moon?.position(jdTT) ?? null,
  };
}
