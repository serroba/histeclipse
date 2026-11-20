/**
 * "Why here?": what each layer on the map has at one place, said plainly, each fact tied to the
 * why of its source. Each layer's feature says its own (#909); this names the place.
 *
 * Pure; the panel that shows it is `ui/whySheet.ts`.
 */

import type { GeoPoint } from '../../state/viewState';

/** A place in words: 36.4°N 43.2°E. */
export function placeText(place: GeoPoint): string {
  const lat = `${Math.abs(place.latitude).toFixed(1)}°${place.latitude < 0 ? 'S' : 'N'}`;
  const lon = `${Math.abs(place.longitude).toFixed(1)}°${place.longitude < 0 ? 'W' : 'E'}`;
  return `${lat} ${lon}`;
}
