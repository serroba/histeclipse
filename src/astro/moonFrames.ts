/**
 * The Moon for drawing frame after frame (#672). A full ELP/MPP02 evaluation takes about 0.25 ms
 * (1 ms on a slow phone), and an eclipse playing asks for one every frame. The Moon's fastest
 * terms take weeks, so between exact positions an hour apart a cubic through the four nearest
 * strays by under a metre (15 cm at worst in 20,000 dates over 4000 BCE–3000 CE, 0.0001″),
 * against the eclipse geometry's hundreds. Playing at an hour a second, ELP runs about once a
 * second. Only the frame-by-frame moment uses it: searches that ask for scattered times keep
 * the exact series, and so does a moment that jumps (travelling through the years).
 */

import { gridBetween } from './gridBetween';
import type { MoonEphemeris } from './moon';
import { julianDayNumber } from '../time/julianDay';

/** Days between the exact positions: an hour. */
export const STEP_DAYS = 1 / 24;
/**
 * Days between them while time plays days a second (#783): on a grid two days apart the Moon
 * strays by under 700 km (measured, frames a day apart over 8 years), under half its radius, as
 * it sweeps some 15° a frame.
 */
const COARSE_DAYS = 2;

/** `exact` evaluated on an hourly grid, and a cubic between; on a two-day one at fast play. */
export function moonBetween(
  exact: MoonEphemeris,
  step = STEP_DAYS,
  coarse = COARSE_DAYS,
): MoonEphemeris {
  const between = gridBetween((jd) => exact.position(julianDayNumber(jd)), step, coarse);
  return { position: (jdTT) => between(jdTT) };
}

/** The frames' Moon for whichever exact ephemeris is current: made again only if that changes. */
export function moonForFrames(): (exact: MoonEphemeris | null) => MoonEphemeris | null {
  let made: { exact: MoonEphemeris; between: MoonEphemeris } | null = null;
  return (exact) => {
    if (exact === null) return null;
    if (made?.exact !== exact) made = { exact, between: moonBetween(exact) };
    return made.between;
  };
}
