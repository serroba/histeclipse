/**
 * How big the impactor that left a crater was, by the scaling laws of the Earth Impact Effects
 * Program (Collins, Melosh & Marcus 2005), run backwards from the final crater's diameter. The
 * answer rests on assumptions (speed, angle, densities) that are rarely known for a crater:
 * the defaults are the program's own typical values, and the site says so where it shows one.
 *
 * Pure.
 */

export interface ImpactAssumptions {
  /** Speed at impact, km/s. */
  readonly speedKmS: number;
  /** Angle from the horizontal, degrees. */
  readonly angleDegrees: number;
  /** Densities, kg/m³. */
  readonly impactorDensity: number;
  readonly targetDensity: number;
}

/** A stony asteroid striking crystalline rock at the most likely angle and a typical speed. */
export const TYPICAL_IMPACT: ImpactAssumptions = {
  speedKmS: 17,
  angleDegrees: 45,
  impactorDensity: 3000,
  targetDensity: 2750,
};

/** Above this final diameter (km) Earth's craters are complex: they slump into broad basins. */
const COMPLEX_KM = 3.2;
const GRAVITY = 9.8;

/** The transient crater, km, that collapsed into a final crater of `finalKm` (Collins eq. 22, 27). */
export function transientDiameterKm(finalKm: number): number {
  if (finalKm <= COMPLEX_KM) return finalKm / 1.25;
  return ((finalKm * COMPLEX_KM ** 0.13) / 1.17) ** (1 / 1.13);
}

/** The impactor's diameter, km, that would leave a final crater of `finalKm` (Collins eq. 21). */
export function impactorDiameterKm(
  finalKm: number,
  assumptions: ImpactAssumptions = TYPICAL_IMPACT,
): number {
  const transientM = transientDiameterKm(finalKm) * 1000;
  const angle = (assumptions.angleDegrees * Math.PI) / 180;
  const factor =
    1.161 *
    (assumptions.impactorDensity / assumptions.targetDensity) ** (1 / 3) *
    (assumptions.speedKmS * 1000) ** 0.44 *
    GRAVITY ** -0.22 *
    Math.sin(angle) ** (1 / 3);
  return (transientM / factor) ** (1 / 0.78) / 1000;
}

/** Where an impact came in from, for the animation: what a study gives, or an assumption. */
export interface Approach {
  /** Degrees clockwise from north that the impactor came from. */
  readonly fromAzimuth: number;
  /** Degrees above the horizon. */
  readonly angleDegrees: number;
  /** Whether a study gives it; otherwise it is an assumption, and said to be. */
  readonly studied: boolean;
}

/** Chicxulub came in from the north-east, steeply: 45–60° (Collins et al. 2020). */
const STUDIED: Readonly<Record<string, Approach>> = {
  Chicxulub: { fromAzimuth: 45, angleDegrees: 60, studied: true },
};

/** How the impact at `crater` came in: a study's answer, or the most likely angle, assumed. */
export function approachOf(crater: string): Approach {
  return STUDIED[crater] ?? { fromAzimuth: 45, angleDegrees: 45, studied: false };
}

/** What the impact card says of the impactor, and of what is known and what assumed. */
export function impactorText(crater: string, finalKm: number): string {
  const approach = approachOf(crater);
  const size = impactorDiameterKm(finalKm, {
    ...TYPICAL_IMPACT,
    angleDegrees: approach.angleDegrees,
  });
  const rounded = size < 1 ? `${String(Math.round(size * 1000))} m` : `${size.toPrecision(2)} km`;
  const angle = approach.studied
    ? `coming in at ${String(approach.angleDegrees)}° from the north-east, as Collins et al. (2020) found`
    : `assuming the most likely angle, ${String(approach.angleDegrees)}°`;
  return `About ${rounded} across, by the crater-scaling laws of Collins et al. (2005), for a stony body at ${String(TYPICAL_IMPACT.speedKmS)} km/s ${angle}. An estimate: the real size, speed and angle are rarely known.`;
}
