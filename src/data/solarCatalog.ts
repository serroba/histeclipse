/** The solar eclipse catalog in `public/data/solar/`, with Besselian elements. */

import * as v from 'valibot';

import { EclipseCatalog, finite, geoPoint, integer, julianDayTT, type Fetch } from './catalog';

/** Polynomial coefficients, lowest power first, in hours from `t0`. */
const coefficients = v.pipe(v.array(finite), v.minLength(1), v.maxLength(4));

const BesselianElementsSchema = v.strictObject({
  /** Reference time, TT: the whole hour nearest greatest eclipse. */
  t0: julianDayTT,
  /** Shadow axis in the fundamental plane, Earth radii. */
  x: coefficients,
  y: coefficients,
  /** Declination of the shadow axis, degrees. */
  d: coefficients,
  /** Ephemeris hour angle of the axis, degrees (as NASA tabulates it; ΔT applied later). */
  mu: coefficients,
  /** Penumbra and umbra radii in the fundamental plane; l2 < 0 means total. */
  l1: coefficients,
  l2: coefficients,
  tanF1: finite,
  tanF2: finite,
});

const SolarEclipseSchema = v.strictObject({
  jdTT: julianDayTT,
  kind: v.picklist(['partial', 'annular', 'total', 'hybrid']),
  /** Shadow axis distance from Earth's center at greatest eclipse, Earth radii. */
  gamma: finite,
  /** Fraction of the Sun's diameter covered at the point of greatest eclipse. */
  magnitude: finite,
  deltaT: integer,
  /** Point of greatest eclipse. */
  greatest: geoPoint,
  elements: BesselianElementsSchema,
});

export type BesselianElements = v.InferOutput<typeof BesselianElementsSchema>;
export type SolarEclipse = v.InferOutput<typeof SolarEclipseSchema>;
export type SolarEclipseKind = SolarEclipse['kind'];
export type SolarCatalog = EclipseCatalog<SolarEclipse>;

export const SolarCatalog = {
  load(baseUrl: string, fetchJson: Fetch): Promise<SolarCatalog> {
    return EclipseCatalog.load(baseUrl, fetchJson, 'solar', SolarEclipseSchema);
  },
};
