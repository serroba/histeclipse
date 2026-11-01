/** The line of text that goes with the sky view: where the observer stands, and how sure we are. */

import type { GeoPoint } from '../state/viewState';
import { formatDuration } from '../time/format';
import { PLANETS, planetUncertainty } from '../astro/planets';
import { compassPoint } from './look';

/** Degrees the sky turns per second of clock time (a sidereal day is 86,164 s). */
const DEGREES_PER_SECOND = 360 / 86_164.0905;
/** Below this, the clock's uncertainty turns the sky by less than the eye could notice. */
const NOTICEABLE_SECONDS = 60;

/** A place in degrees with hemispheres, like "32.54° N, 44.42° E". */
export function formatPlace({ latitude, longitude }: GeoPoint): string {
  const lat = `${Math.abs(latitude).toFixed(2)}° ${latitude < 0 ? 'S' : 'N'}`;
  const lon = `${Math.abs(longitude).toFixed(2)}° ${longitude < 0 ? 'W' : 'E'}`;
  return `${lat}, ${lon}`;
}

export function skyCaption(options: {
  readonly place: GeoPoint;
  /** A name for the place, such as "Babylon", when there is one. */
  readonly placeName?: string | null;
  readonly azimuth: number;
  /** One-sigma uncertainty of ΔT at this moment, in seconds. */
  readonly uncertaintySeconds: number;
}): string {
  const at =
    options.placeName === undefined || options.placeName === null
      ? `at ${formatPlace(options.place)}`
      : `in ${options.placeName} (${formatPlace(options.place)})`;
  const where = `Standing ${at}, facing ${compassPoint(options.azimuth)}.`;
  if (options.uncertaintySeconds < NOTICEABLE_SECONDS) return where;
  const turn = options.uncertaintySeconds * DEGREES_PER_SECOND;
  return (
    `${where} ΔT ±${formatDuration(options.uncertaintySeconds)}: ` +
    `the sky may be turned up to ±${turn.toFixed(1)}°.`
  );
}

/**
 * What an eclipse looks like from here, if one is under way and in sight: how much of the Sun
 * the Moon covers, or whether Earth's shadow is on the Moon. Empty otherwise.
 */
export function eclipseNote(options: {
  /** Share of the Sun's disc still visible, and the Sun's altitude in degrees. */
  readonly sunVisible: number;
  readonly sunAltitude: number;
  /** Sunlight reaching the middle of the Moon past Earth, and the Moon's altitude. */
  readonly moonSunlight: number;
  readonly moonAltitude: number;
}): string {
  if (options.sunAltitude > -1 && options.sunVisible < 1) {
    if (options.sunVisible === 0) return 'Totality: the Moon hides the whole Sun.';
    const covered = Math.min(99, Math.max(1, Math.round((1 - options.sunVisible) * 100)));
    return `The Moon covers ${String(covered)}% of the Sun.`;
  }
  if (options.moonAltitude > -1 && options.moonSunlight < 1) {
    return options.moonSunlight === 0
      ? 'The Moon is inside Earth’s darkest shadow, lit only red by sunsets around the world.'
      : 'Earth’s shadow is falling on the Moon.';
  }
  return '';
}

/**
 * A word on how far to trust the planets' places in a given year: silent while every planet is
 * within half an arcminute of DE441, otherwise the error budget of those that drift.
 */
export function planetNote(year: number): string {
  const loose = PLANETS.map((planet) => [planet, planetUncertainty(planet, year)] as const).filter(
    ([, arcminutes]) => arcminutes > 0.5,
  );
  if (loose.length === 0) return '';
  const parts = loose.map(
    ([planet, arcminutes]) =>
      `${planet[0]?.toUpperCase() ?? ''}${planet.slice(1)} ±${String(arcminutes)}′`,
  );
  return `This far back, planet positions are good to ${parts.join(', ')}.`;
}
