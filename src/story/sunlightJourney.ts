/**
 * Sunlight's journey to Earth, as the 3D story tells it (#317): one photon of red light leaves
 * the surface and crosses to Earth. On screen the trip takes a few seconds; beside the photon, a
 * clock says the real time, 8 minutes 19 seconds at the speed of light. The distance is drawn
 * short (Earth is 215 Sun radii away); Earth's size beside the Sun is true, 1/109 of it.
 */

/** The speed of light, km/s (exact, by definition of the metre). */
export const LIGHT_KM_S = 299_792.458;
/** The astronomical unit, km (exact, IAU 2012): Earth's mean distance from the Sun. */
export const AU_KM = 149_597_870.7;
/** The Sun's radius, km (IAU 2015 nominal). */
export const SUN_RADIUS_KM = 695_700;
/** Earth's equatorial radius, km (IAU 2015 nominal). */
export const EARTH_RADIUS_KM = 6378.1;

/** How long light takes from the Sun to Earth, s: about 499. */
export const TRAVEL_S = AU_KM / LIGHT_KM_S;

/** The red light the story follows, as the leaf at its end takes it in: 680 nm. */
export const RED_NM = 680;
/** Planck's constant times the speed of light, eV·nm. */
const HC_EV_NM = 1239.84198;

/** A wavelength's frequency, THz. */
export function terahertz(nm: number): number {
  return LIGHT_KM_S / nm;
}

/** A wavelength's photon energy, eV. */
export function electronVolts(nm: number): number {
  return HC_EV_NM / nm;
}

/** Seconds as the clock beside the photon says them: "4 min 9 s". */
export function clock(seconds: number): string {
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return minutes === 0 ? `${String(rest)} s` : `${String(minutes)} min ${String(rest)} s`;
}

/** The real time gone at `progress` (0 to 1) of the trip, s. */
export function elapsedAt(progress: number): number {
  return TRAVEL_S * Math.min(1, Math.max(0, progress));
}

/** The real distance gone at `progress` of the trip, km. */
export function kilometresAt(progress: number): number {
  return AU_KM * Math.min(1, Math.max(0, progress));
}

/** How many Sun radii away Earth really is: about 215. */
export const EARTH_DISTANCE_SUN_RADII = AU_KM / SUN_RADIUS_KM;
/** How much smaller Earth is than the Sun: about 109 times. */
export const SUN_OVER_EARTH = SUN_RADIUS_KM / EARTH_RADIUS_KM;

/** The facts written beside the scene. */
export const JOURNEY_FACTS: readonly string[] = [
  `150 million km to Earth, at the speed of light, ${Math.round(LIGHT_KM_S).toLocaleString('en')} km/s`,
  `${clock(TRAVEL_S)}: the light seen now left the surface that long ago`,
  `red light: ${String(RED_NM)} nm, ${String(Math.round(terahertz(RED_NM)))} THz, ${electronVolts(RED_NM).toFixed(1)} eV, the colour chlorophyll absorbs`,
  `drawn short: Earth is ${String(Math.round(EARTH_DISTANCE_SUN_RADII))} Sun radii away, and ${String(Math.round(SUN_OVER_EARTH))} times smaller than the Sun, as drawn`,
];
