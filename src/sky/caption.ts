/** The line of text that goes with the sky view: where the observer stands, and how sure we are. */

import type { GeoPoint } from '../state/viewState';
import { formatDuration } from '../time/format';
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
  readonly azimuth: number;
  /** One-sigma uncertainty of ΔT at this moment, in seconds. */
  readonly uncertaintySeconds: number;
}): string {
  const where = `Standing at ${formatPlace(options.place)}, facing ${compassPoint(options.azimuth)}.`;
  if (options.uncertaintySeconds < NOTICEABLE_SECONDS) return where;
  const turn = options.uncertaintySeconds * DEGREES_PER_SECOND;
  return (
    `${where} ΔT ±${formatDuration(options.uncertaintySeconds)}: ` +
    `the sky may be turned up to ±${turn.toFixed(1)}°.`
  );
}
