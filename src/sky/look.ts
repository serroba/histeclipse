/** Turning and zooming the observer's view, and choosing what the sky view draws. */

import type { Constellation } from '../data/sky';
import { SKY_FOV_RANGE, type Figures, type SkyLook } from '../state/viewState';

/** How far below the horizon the view may tilt: enough to see the ground, not to get lost. */
export const LOWEST_LOOK = -30;

/** Unit vector of a look in the horizon frame: x east, y north, z up. */
export function lookDirection({ azimuth, altitude }: SkyLook): [number, number, number] {
  const az = (azimuth * Math.PI) / 180;
  const alt = (altitude * Math.PI) / 180;
  return [Math.sin(az) * Math.cos(alt), Math.cos(az) * Math.cos(alt), Math.sin(alt)];
}

/**
 * Turn the view by a drag of `dx`, `dy` pixels on a view `height` pixels tall: the sky moves
 * with the pointer, so dragging right turns the view left (west, facing south).
 */
export function dragLook(look: SkyLook, dx: number, dy: number, height: number): SkyLook {
  const degreesPerPixel = look.fov / Math.max(height, 1);
  const azimuth = (((look.azimuth - dx * degreesPerPixel) % 360) + 360) % 360;
  const altitude = Math.min(90, Math.max(LOWEST_LOOK, look.altitude + dy * degreesPerPixel));
  return { ...look, azimuth, altitude };
}

/** Zoom by a factor on the field of view (below 1 zooms in), within the allowed range. */
export function zoomLook(look: SkyLook, factor: number): SkyLook {
  const fov = Math.min(SKY_FOV_RANGE.max, Math.max(SKY_FOV_RANGE.min, look.fov * factor));
  return { ...look, fov };
}

/** A look rounded as the link writes it, so the view and the link agree. */
export function roundLook({ azimuth, altitude, fov }: SkyLook): SkyLook {
  const tenth = (value: number) => Math.round(value * 10) / 10;
  return { azimuth: tenth(azimuth) % 360, altitude: tenth(altitude), fov: tenth(fov) };
}

/** The constellations whose figures and names are drawn. */
export function shownConstellations(
  constellations: readonly Constellation[],
  figures: Figures,
): readonly Constellation[] {
  if (figures === 'none') return [];
  return figures === 'all' ? constellations : constellations.filter(({ rank }) => rank === 1);
}

/** A figure's runs of stars as pairs of star indices, one pair per line segment. */
export function figureSegments(constellations: readonly Constellation[]): [number, number][] {
  const segments: [number, number][] = [];
  for (const { lines } of constellations) {
    for (const run of lines) {
      for (let i = 1; i < run.length; i++) {
        const from = run[i - 1];
        const to = run[i];
        if (from !== undefined && to !== undefined) segments.push([from, to]);
      }
    }
  }
  return segments;
}

/** The eight compass points, for labels along the horizon. */
export const COMPASS: readonly (readonly [string, number])[] = [
  ['N', 0],
  ['NE', 45],
  ['E', 90],
  ['SE', 135],
  ['S', 180],
  ['SW', 225],
  ['W', 270],
  ['NW', 315],
];

/** The compass point nearest an azimuth, to describe where the view faces. */
export function compassPoint(azimuth: number): string {
  const index = Math.round((((azimuth % 360) + 360) % 360) / 45) % 8;
  return COMPASS[index]?.[0] ?? 'N';
}
