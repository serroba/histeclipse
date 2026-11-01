/**
 * Whether an eclipse could be seen from somewhere inside a region, such as an empire's
 * territory, and how deep it was there.
 *
 * Lunar: the eclipse counts if the Moon stood above the horizon (geocentric altitude above 0°,
 * as in `visibility.ts`) at some point of the region while the Moon was in the umbra, or, for a
 * penumbral eclipse, in the penumbra.
 *
 * Solar: the eclipse counts if the Moon's penumbra touched the region with the Sun up. It is
 * total or annular there if the centre line of the path crossed the region; a path that only
 * clips a border without its centre line crossing is reported as partial.
 *
 * Each answer is worked out for the catalog's ΔT and for ΔT ± 1σ. "maybe" means those disagree.
 */

import type { LunarEclipse } from '../data/lunarCatalog';
import type { SolarEclipse } from '../data/solarCatalog';
import type { GeoPoint } from '../state/viewState';
import { elementAt } from '../util/arrays';
import { lunarSemiDurations, SUBLUNAR_DRIFT_DEGREES_PER_HOUR } from './lunarPhases';
import {
  ELEMENTS_HALF_SPAN_HOURS,
  localCircumstances,
  shadowAtHours,
  type ShadowGeometry,
} from './solar';
import { longitudeUncertainty, shiftLongitude } from './visibility';

const RADIANS = Math.PI / 180;
/** Grid spacing for points inside a region, degrees: fine enough for a shadow ~70° across. */
const GRID_DEGREES = 2;
/** Time steps: the penumbra is wide, the centre line needs short steps not to jump a region. */
const PENUMBRA_STEP_HOURS = 5 / 60;
const CENTRE_STEP_HOURS = 10 / 3600;
const MOON_STEP_MINUTES = 10;

export type SeenPhase = 'total' | 'annular' | 'partial' | 'penumbral' | 'none';
export type SeenVerdict = 'seen' | 'maybe' | 'not';

export interface SeenIn {
  /** Seen for ΔT − σ, ΔT and ΔT + σ ("seen"), for some of them ("maybe"), or for none. */
  readonly verdict: SeenVerdict;
  /** The deepest phase seen somewhere in the region, for the catalog's ΔT. */
  readonly phase: SeenPhase;
  /** The deepest phase for each of the three ΔT values, without repeats: more than one means ΔT decides. */
  readonly phases: readonly SeenPhase[];
}

type Ring = readonly (readonly [number, number])[];

interface UnwrappedRing {
  readonly points: readonly (readonly [number, number])[];
  readonly west: number;
  readonly east: number;
  readonly south: number;
  readonly north: number;
}

/** A region prepared for repeated tests: its rings, and points spread over it. */
export interface Region {
  readonly rings: readonly UnwrappedRing[];
  /** Ring corners and grid points inside, where the Sun and Moon are tested. */
  readonly samples: readonly GeoPoint[];
}

function unwrap(ring: Ring): UnwrappedRing {
  const points: [number, number][] = [];
  let shift = 0;
  let previous: number | null = null;
  for (const [lon, lat] of ring) {
    if (previous !== null) {
      if (lon - previous > 180) shift -= 360;
      else if (previous - lon > 180) shift += 360;
    }
    previous = lon;
    points.push([lon + shift, lat]);
  }
  const lons = points.map(([lon]) => lon);
  const lats = points.map(([, lat]) => lat);
  return {
    points,
    west: Math.min(...lons),
    east: Math.max(...lons),
    south: Math.min(...lats),
    north: Math.max(...lats),
  };
}

/** Even–odd ray casting in a ring whose longitudes may run past ±180°. */
function inUnwrapped(ring: UnwrappedRing, longitude: number, latitude: number): boolean {
  if (latitude < ring.south || latitude > ring.north) return false;
  return [longitude - 360, longitude, longitude + 360].some((lon) => {
    if (lon < ring.west || lon > ring.east) return false;
    let inside = false;
    const { points } = ring;
    for (let index = 0, before = points.length - 1; index < points.length; before = index++) {
      const [x1, y1] = elementAt(points, index);
      const [x2, y2] = elementAt(points, before);
      if (y1 > latitude !== y2 > latitude && lon < ((x2 - x1) * (latitude - y1)) / (y2 - y1) + x1) {
        inside = !inside;
      }
    }
    return inside;
  });
}

/** Whether `point` lies inside the region. */
export function inRegion(region: Region, point: GeoPoint): boolean {
  return region.rings.some((ring) => inUnwrapped(ring, point.longitude, point.latitude));
}

function normalLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

/** Prepare a territory's rings (degrees, [lon, lat]) for tests. */
export function regionOf(territory: { readonly rings: readonly Ring[] }): Region {
  const rings = territory.rings.filter((ring) => ring.length >= 3).map(unwrap);
  const samples: GeoPoint[] = [];
  for (const ring of rings) {
    for (const [lon, lat] of ring.points) {
      samples.push({ latitude: lat, longitude: normalLongitude(lon) });
    }
    const firstLat = Math.ceil(ring.south / GRID_DEGREES) * GRID_DEGREES;
    const firstLon = Math.ceil(ring.west / GRID_DEGREES) * GRID_DEGREES;
    for (let lat = firstLat; lat <= ring.north; lat += GRID_DEGREES) {
      for (let lon = firstLon; lon <= ring.east; lon += GRID_DEGREES) {
        if (inUnwrapped(ring, lon, lat)) {
          samples.push({ latitude: lat, longitude: normalLongitude(lon) });
        }
      }
    }
  }
  return { rings, samples };
}

function summarise(byDeltaT: readonly [SeenPhase, SeenPhase, SeenPhase]): SeenIn {
  const [early, nominal, late] = byDeltaT;
  const seen = byDeltaT.filter((phase) => phase !== 'none').length;
  return {
    verdict: seen === 3 ? 'seen' : seen === 0 ? 'not' : 'maybe',
    phase: nominal,
    phases: [...new Set([early, nominal, late])],
  };
}

/** Unit vector of a point on a sphere. */
type Vector = readonly [number, number, number];

function unit({ latitude, longitude }: GeoPoint): Vector {
  const lat = latitude * RADIANS;
  const lon = longitude * RADIANS;
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}

/** Whether the Moon, overhead at `sublunar`, is above the horizon anywhere in the samples. */
function moonUpSomewhere(samples: readonly Vector[], sublunar: GeoPoint): boolean {
  const [x, y, z] = unit(sublunar);
  return samples.some(([a, b, c]) => a * x + b * y + c * z > 0);
}

/** Where `eclipse` was seen in `region`, with ΔT uncertain by ±`uncertaintySeconds`. */
export function lunarSeenIn(
  eclipse: LunarEclipse,
  region: Region,
  uncertaintySeconds: number,
): SeenIn {
  const vectors = region.samples.map(unit);
  const [latitude, longitude] = eclipse.sublunar;
  const semi = lunarSemiDurations(eclipse.gamma);
  // The penumbral phase of a deeper eclipse is too faint to count; a penumbral eclipse has nothing else.
  const windows: readonly [SeenPhase, number][] =
    eclipse.kind === 'penumbral'
      ? [['penumbral', semi.penumbral]]
      : [
          ['total', semi.total],
          ['partial', semi.partial],
        ];
  const shift = longitudeUncertainty(uncertaintySeconds);
  const deepest = (degrees: number): SeenPhase => {
    const at = (minutes: number): GeoPoint =>
      shiftLongitude(
        { latitude, longitude },
        degrees - (minutes / 60) * SUBLUNAR_DRIFT_DEGREES_PER_HOUR,
      );
    for (const [phase, half] of windows) {
      if (half <= 0) continue;
      const steps = Math.ceil(half / MOON_STEP_MINUTES);
      for (let step = -steps; step <= steps; step += 1) {
        const minutes = (step / steps) * half;
        if (moonUpSomewhere(vectors, at(minutes))) return phase;
      }
    }
    return 'none';
  };
  return summarise([deepest(-shift), deepest(0), deepest(shift)]);
}

/**
 * Where the shadow axis meets Earth (taken as a sphere: the centre line moves by up to
 * ~20 km), and whether the eclipse there is total or annular. Null if the axis misses Earth.
 */
export function centreLinePoint(
  geometry: ShadowGeometry,
): { readonly point: GeoPoint; readonly phase: 'total' | 'annular' } | null {
  const { x, y } = geometry;
  const squared = 1 - x * x - y * y;
  if (squared <= 0) return null;
  const zeta = Math.sqrt(squared);
  const d = geometry.d * RADIANS;
  const latitude = Math.asin(y * Math.cos(d) + zeta * Math.sin(d)) / RADIANS;
  const hourAngle = Math.atan2(x, zeta * Math.cos(d) - y * Math.sin(d)) / RADIANS;
  const umbra = geometry.l2 - zeta * geometry.tanF2;
  return {
    point: { latitude, longitude: normalLongitude(hourAngle - geometry.mu) },
    phase: umbra < 0 ? 'total' : 'annular',
  };
}

/** Where `eclipse` was seen in `region`, with ΔT uncertain by ±`uncertaintySeconds`. */
export function solarSeenIn(
  eclipse: SolarEclipse,
  region: Region,
  uncertaintySeconds: number,
): SeenIn {
  const { elements } = eclipse;
  const deepest = (deltaT: number): SeenPhase => {
    let best: SeenPhase = 'none';
    for (let hours = -ELEMENTS_HALF_SPAN_HOURS; hours <= ELEMENTS_HALF_SPAN_HOURS;) {
      const centre = centreLinePoint(shadowAtHours(elements, hours, deltaT));
      if (centre !== null && inRegion(region, centre.point)) {
        // A hybrid eclipse is total along part of its path: that is the deeper phase.
        if (centre.phase === 'total') return 'total';
        best = 'annular';
      }
      hours += CENTRE_STEP_HOURS;
    }
    if (best !== 'none') return best;
    for (
      let hours = -ELEMENTS_HALF_SPAN_HOURS;
      hours <= ELEMENTS_HALF_SPAN_HOURS;
      hours += PENUMBRA_STEP_HOURS
    ) {
      const geometry = shadowAtHours(elements, hours, deltaT);
      if (region.samples.some((place) => localCircumstances(geometry, place).phase !== 'none')) {
        return 'partial';
      }
    }
    return 'none';
  };
  return summarise([
    deepest(eclipse.deltaT - uncertaintySeconds),
    deepest(eclipse.deltaT),
    deepest(eclipse.deltaT + uncertaintySeconds),
  ]);
}
