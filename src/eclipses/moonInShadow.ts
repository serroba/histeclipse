/**
 * The Moon crossing Earth's shadow, as seen from Earth: a schematic view for lunar eclipses.
 *
 * Coordinates are in Earth radii at the Moon's distance, centred on the shadow's axis, with
 * north up and east to the left (as the sky looks to someone facing the Moon from the north).
 * The Moon passes the axis at distance gamma (positive = north) and moves east relative to the
 * shadow at Meeus's mean rate. Its path is drawn parallel to the ecliptic, which ignores the
 * ~5° tilt of the lunar orbit: fine for picturing the eclipse, not for measuring position angles.
 */

import type { LunarEclipse } from '../data/lunarCatalog';
import {
  lunarPhaseAt,
  MOON_RADIUS,
  PENUMBRA,
  RELATIVE_SPEED,
  UMBRA,
  type LunarPhase,
} from './lunarPhases';

export interface MoonInShadow {
  /** Moon's centre: x positive to the west (right), y positive to the north (up). */
  readonly x: number;
  readonly y: number;
  readonly moonRadius: number;
  readonly umbraRadius: number;
  readonly penumbraRadius: number;
  /** How deep the Moon is in the umbra, in Moon diameters (above 1 means totality). */
  readonly umbralDepth: number;
  readonly phase: LunarPhase;
}

export function moonInShadow(eclipse: LunarEclipse, offsetMinutes: number): MoonInShadow {
  // Before greatest eclipse the Moon is still west of the shadow, and it moves east.
  const x = -(RELATIVE_SPEED * offsetMinutes) / 60;
  const y = eclipse.gamma;
  const distance = Math.hypot(x, y);
  return {
    x,
    y,
    moonRadius: MOON_RADIUS,
    umbraRadius: UMBRA,
    penumbraRadius: PENUMBRA,
    umbralDepth: (UMBRA + MOON_RADIUS - distance) / (2 * MOON_RADIUS),
    phase: lunarPhaseAt(eclipse, offsetMinutes),
  };
}
