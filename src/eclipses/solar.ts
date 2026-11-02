/**
 * The Moon's shadow on Earth, from Besselian elements.
 *
 * Local circumstances follow the Explanatory Supplement to the Astronomical Almanac (ch. 11)
 * and NASA's conventions: an observer's position is projected onto the fundamental plane
 * (ξ, η, ζ), the shadow cones' radii there are L1 = l1 − ζ tan f1 (penumbra) and
 * L2 = l2 − ζ tan f2 (umbra), and the eclipse magnitude is (L1 − Δ) / (L1 + L2), where Δ is
 * the observer's distance from the shadow axis. The same few lines run per pixel on the GPU.
 */

import type { BesselianElements } from '../data/solarCatalog';
import type { GeoPoint } from '../state/viewState';
import { julianDayNumber, type JulianDay } from '../time/julianDay';
import { elementAt } from '../util/arrays';

const RADIANS = Math.PI / 180;
/** b / a for Earth (WGS84): 1 − flattening. */
const POLAR_RATIO = 0.99664719;
/** Hour-angle growth per second of UT: 360° × 1.002737909 per 86,400 s. */
export const SIDEREAL_DEGREES_PER_SECOND = (360 * 1.002737909) / 86_400;
/** Elements are fitted over ±3 hours around t0 and not valid beyond. */
export const ELEMENTS_HALF_SPAN_HOURS = 3;

/** Elements evaluated at one instant. */
export interface ShadowGeometry {
  readonly x: number;
  readonly y: number;
  /** Declination of the shadow axis, degrees. */
  readonly d: number;
  /** Greenwich hour angle of the axis, degrees, for the chosen ΔT. */
  readonly mu: number;
  readonly l1: number;
  readonly l2: number;
  readonly tanF1: number;
  readonly tanF2: number;
}

export type LocalPhase = 'none' | 'partial' | 'annular' | 'total';

export interface LocalCircumstances {
  readonly phase: LocalPhase;
  /** Fraction of the Sun's diameter covered; 0 when there is no eclipse here. */
  readonly magnitude: number;
  /** Whether the Sun is above the horizon (geometric, ignoring refraction). */
  readonly sunUp: boolean;
}

function polynomial(coefficients: readonly number[], hours: number): number {
  let value = 0;
  for (let index = coefficients.length - 1; index >= 0; index -= 1) {
    value = value * hours + elementAt(coefficients, index);
  }
  return value;
}

/** Hours from the elements' reference time t0. */
export function hoursFromT0(elements: BesselianElements, jdTT: JulianDay): number {
  return (jdTT - elements.t0) * 24;
}

/**
 * The shadow's geometry at `jdTT`, with the Greenwich hour angle for `deltaTSeconds`.
 * Returns null outside the ±3 hours the elements were fitted for.
 */
export function shadowAt(
  elements: BesselianElements,
  jdTT: JulianDay,
  deltaTSeconds: number,
): ShadowGeometry | null {
  const hours = hoursFromT0(elements, jdTT);
  if (Math.abs(hours) > ELEMENTS_HALF_SPAN_HOURS) return null;
  return shadowAtHours(elements, hours, deltaTSeconds);
}

/** The shadow's geometry `hours` from t0, with no check on the span. */
export function shadowAtHours(
  elements: BesselianElements,
  hours: number,
  deltaTSeconds: number,
): ShadowGeometry {
  return {
    x: polynomial(elements.x, hours),
    y: polynomial(elements.y, hours),
    d: polynomial(elements.d, hours),
    mu: polynomial(elements.mu, hours) - deltaTSeconds * SIDEREAL_DEGREES_PER_SECOND,
    l1: polynomial(elements.l1, hours),
    l2: polynomial(elements.l2, hours),
    tanF1: elements.tanF1,
    tanF2: elements.tanF2,
  };
}

/** Where `place` stands against the shadow at one instant, in Earth radii on the fundamental plane. */
function placeInShadow(shadow: ShadowGeometry, place: GeoPoint) {
  const latitude = place.latitude * RADIANS;
  // Geocentric position on the ellipsoid: ρ sin φ′ and ρ cos φ′.
  const u = Math.atan(POLAR_RATIO * Math.tan(latitude));
  const rhoSin = POLAR_RATIO * Math.sin(u);
  const rhoCos = Math.cos(u);
  const hourAngle = (shadow.mu + place.longitude) * RADIANS;
  const d = shadow.d * RADIANS;
  const xi = rhoCos * Math.sin(hourAngle);
  const eta = rhoSin * Math.cos(d) - rhoCos * Math.cos(hourAngle) * Math.sin(d);
  const zeta = rhoSin * Math.sin(d) + rhoCos * Math.cos(hourAngle) * Math.cos(d);

  return {
    sunUp: zeta > 0,
    penumbra: shadow.l1 - zeta * shadow.tanF1,
    umbra: shadow.l2 - zeta * shadow.tanF2,
    distance: Math.hypot(shadow.x - xi, shadow.y - eta),
  };
}

/** How the eclipse looks from `place` (at sea level) given the shadow at one instant. */
export function localCircumstances(shadow: ShadowGeometry, place: GeoPoint): LocalCircumstances {
  const { sunUp, penumbra, umbra, distance } = placeInShadow(shadow, place);
  if (!sunUp || distance >= penumbra) return { phase: 'none', magnitude: 0, sunUp };
  if (distance < Math.abs(umbra)) {
    // Inside the umbra or antumbra, magnitude is the ratio of the Moon's apparent diameter to
    // the Sun's: above 1 for a total eclipse, below 1 for an annular one.
    const ratio = (penumbra - umbra) / (penumbra + umbra);
    return { phase: umbra < 0 ? 'total' : 'annular', magnitude: ratio, sunUp };
  }
  // Elsewhere, the fraction of the Sun's diameter the Moon covers.
  return { phase: 'partial', magnitude: (penumbra - distance) / (penumbra + umbra), sunUp };
}

export interface MaximumEclipse {
  readonly jdTT: JulianDay;
  readonly circumstances: LocalCircumstances;
}

/**
 * When the eclipse is deepest at `place`, searched over the elements' ±3 hour span.
 * Returns null if the place sees no eclipse at all.
 */
export function maximumEclipseAt(
  elements: BesselianElements,
  deltaTSeconds: number,
  place: GeoPoint,
): MaximumEclipse | null {
  const shadow = (seconds: number): ShadowGeometry =>
    shadowAtHours(elements, seconds / 3600, deltaTSeconds);
  const at = (seconds: number): LocalCircumstances => localCircumstances(shadow(seconds), place);
  // Deepest is where the place comes closest to the shadow's axis. The magnitude alone won't
  // do: inside the umbra it is the same all through totality.
  const depth = (seconds: number): number => {
    const { sunUp, penumbra, umbra, distance } = placeInShadow(shadow(seconds), place);
    return sunUp ? (penumbra - distance) / (penumbra + umbra) : 0;
  };
  // Scan the whole span in 10 s steps, then the best 20 s window in 0.1 s steps.
  const span = ELEMENTS_HALF_SPAN_HOURS * 3600;
  const deepest = (from: number, to: number, step: number): number => {
    let bestSeconds = from;
    let bestDepth = depth(from);
    for (let seconds = from + step; seconds <= to; seconds += step) {
      const here = depth(seconds);
      if (here > bestDepth) {
        bestDepth = here;
        bestSeconds = seconds;
      }
    }
    return bestSeconds;
  };
  const coarse = deepest(-span, span, 10);
  if (at(coarse).magnitude <= 0) return null;
  const seconds = deepest(Math.max(-span, coarse - 10), Math.min(span, coarse + 10), 0.1);
  return {
    jdTT: julianDayNumber(elements.t0 + seconds / 86_400),
    circumstances: at(seconds),
  };
}

export interface SolarOutlook {
  /** Deepest eclipse at the place for the catalog's ΔT; null if none. */
  readonly nominal: MaximumEclipse | null;
  /** Phases seen at maximum for ΔT − σ, ΔT and ΔT + σ: more than one means ΔT decides. */
  readonly phases: readonly LocalPhase[];
}

/** What `place` saw, allowing for ΔT uncertainty of ±`uncertaintySeconds`. */
export function solarOutlook(
  elements: BesselianElements,
  deltaTSeconds: number,
  uncertaintySeconds: number,
  place: GeoPoint,
): SolarOutlook {
  const phaseFor = (seconds: number): LocalPhase =>
    maximumEclipseAt(elements, seconds, place)?.circumstances.phase ?? 'none';
  const nominal = maximumEclipseAt(elements, deltaTSeconds, place);
  const phases = new Set<LocalPhase>([
    phaseFor(deltaTSeconds - uncertaintySeconds),
    nominal?.circumstances.phase ?? 'none',
    phaseFor(deltaTSeconds + uncertaintySeconds),
  ]);
  return { nominal, phases: [...phases] };
}
