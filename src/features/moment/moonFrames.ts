/**
 * The Moon for drawing frame after frame (#672). A full ELP/MPP02 evaluation takes about 0.25 ms
 * (1 ms on a slow phone), and an eclipse playing asks for one every frame. The Moon's fastest
 * terms take weeks, so between exact positions an hour apart a cubic through the four nearest
 * strays by under a metre (15 cm at worst in 20,000 dates over 4000 BCE–3000 CE, 0.0001″),
 * against the eclipse geometry's hundreds. Playing at an hour a second, ELP runs about once a
 * second. Only the frame-by-frame moment uses it: searches that ask for scattered times keep
 * the exact series.
 */

import type { EquatorialVector, MoonEphemeris } from '../../astro/moon';
import { julianDayNumber } from '../../time/julianDay';

/** Days between the exact positions: an hour. */
export const STEP_DAYS = 1 / 24;
/** Exact positions kept: the four a moment needs, and room to play either way. */
const KEPT = 8;

/** `exact` evaluated on an hourly grid, and a cubic between. */
export function moonBetween(exact: MoonEphemeris, step = STEP_DAYS): MoonEphemeris {
  const nodes = new Map<number, EquatorialVector>();
  function node(index: number): EquatorialVector {
    let position = nodes.get(index);
    if (position === undefined) {
      position = exact.position(julianDayNumber(index * step));
      nodes.set(index, position);
      const [oldest] = nodes.keys();
      if (nodes.size > KEPT && oldest !== undefined) nodes.delete(oldest);
    }
    return position;
  }
  return {
    position(jdTT) {
      const along = jdTT / step;
      const index = Math.floor(along);
      const x = along - index;
      if (x === 0) return node(index);
      // Lagrange's weights for the grid points at −1, 0, 1 and 2, at x between 0 and 1.
      const weights = [
        (-x * (x - 1) * (x - 2)) / 6,
        ((x + 1) * (x - 1) * (x - 2)) / 2,
        (-(x + 1) * x * (x - 2)) / 2,
        ((x + 1) * x * (x - 1)) / 6,
      ];
      const points = [node(index - 1), node(index), node(index + 1), node(index + 2)];
      const sum = (axis: 0 | 1 | 2): number =>
        points.reduce((total, point, at) => total + (weights[at] ?? 0) * point[axis], 0);
      return [sum(0), sum(1), sum(2)];
    },
  };
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
