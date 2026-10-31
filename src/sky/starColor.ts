/**
 * The colour of a star from its B−V index: blue-white for hot stars, orange for cool ones.
 * B−V gives the temperature (Ballesteros 2012); the temperature gives a colour (Helland's fit
 * to the blackbody colours), softened toward white, since the eye sees star colours faintly.
 */

/** Effective temperature in kelvin from a B−V colour index. */
export function temperatureFromBV(bv: number): number {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}

/** Linear RGB (0..1) for a star, white when its colour is unknown. */
export function starColor(bv: number | null): readonly [number, number, number] {
  if (bv === null) return [1, 1, 1];
  // Clamp to the range of real stars, which also keeps the formula away from its pole.
  const kelvin = temperatureFromBV(Math.min(2, Math.max(-0.4, bv))) / 100;
  const red = kelvin <= 66 ? 255 : 329.698727446 * (kelvin - 60) ** -0.1332047592;
  const green =
    kelvin <= 66
      ? 99.4708025861 * Math.log(kelvin) - 161.1195681661
      : 288.1221695283 * (kelvin - 60) ** -0.0755148492;
  const blue =
    kelvin >= 66 ? 255 : kelvin <= 19 ? 0 : 138.5177312231 * Math.log(kelvin - 10) - 305.0447927307;
  const soften = (value: number) => 0.45 + 0.55 * Math.min(1, Math.max(0, value / 255));
  return [soften(red), soften(green), soften(blue)];
}
