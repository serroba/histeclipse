/**
 * The wave as it leaves its source (#832): two black holes orbiting send out a quadrupole wave,
 * two-armed, which reaches a place at distance r a time r/c later and weaker as 1/r. Seen from
 * a direction at angle ι to the orbit's axis and azimuth φ, its polarisations are
 *   h₊ = A(t − r/c)·(1 + cos²ι)/2·cos(2Φ(t − r/c) − 2φ),
 *   h× = A(t − r/c)·cos ι·sin(2Φ(t − r/c) − 2φ),
 * where Φ is the orbit's phase and A the wave's amplitude. The measured wave gives 2Φ and A as
 * a face-on observer saw them: h₊ = A cos 2Φ, h× = A sin 2Φ, so no phase need be unwrapped:
 * cos(2Φ − 2φ) = (h₊ cos 2φ + h× sin 2φ)/A.
 *
 * In the orbit's own plane (ι = 90°) only h₊ remains, at half strength: that is the sheet the
 * source chapter draws. Its spiral is not drawn: it comes out of these formulas.
 *
 * Pure: no DOM, no three.js.
 */

import { turnBetween, type Polarisations, type Waveform } from './strain';

/**
 * The wave at a place: `r` from the source (in the units of `speed`), azimuth `phi` and angle
 * `iota` from the orbit's axis, at time `t` (s from the merger), given the wave as seen face on
 * at distance `r0`, travelling at `speed` per second.
 */
export function sourceStrain(
  wave: Waveform,
  where: { readonly r: number; readonly phi: number; readonly iota: number },
  t: number,
  speed: number,
  r0: number,
): Polarisations {
  const left = wave.at(t - where.r / speed);
  const along = left.plus * Math.cos(2 * where.phi) + left.cross * Math.sin(2 * where.phi);
  const across = left.cross * Math.cos(2 * where.phi) - left.plus * Math.sin(2 * where.phi);
  const fall = r0 / where.r;
  const tilt = Math.cos(where.iota);
  return { plus: fall * ((1 + tilt * tilt) / 2) * along, cross: fall * tilt * across };
}

/**
 * The wave as it left the source at each of `bins` distances out to `reach`, at time `t`: the
 * face-on h₊ and h× it then had, for the shader to turn by each place's azimuth and weaken by its
 * distance. Pairs, nearest first.
 */
export function radialTable(
  wave: Waveform,
  t: number,
  speed: number,
  reach: number,
  bins: number,
): Float32Array {
  const table = new Float32Array(bins * 2);
  for (let index = 0; index < bins; index += 1) {
    const r = (reach * index) / (bins - 1);
    const { plus, cross } = wave.at(t - r / speed);
    table[2 * index] = plus;
    table[2 * index + 1] = cross;
  }
  return table;
}

export interface Orbit {
  /** Whether the two are still two at `t`: before the merger. */
  two(t: number): boolean;
  /** The orbit's phase at `t`, radians, rising: half the wave's. */
  angle(t: number): number;
  /** How far apart the two are at `t`, as a share of their distance at the wave's start. */
  separation(t: number): number;
}

/**
 * The two black holes' orbit, from the wave: its phase, half the wave's, followed sample by
 * sample so it keeps rising; its size by Kepler's third law, a ∝ f^(−2/3), from the pitch.
 */
export function orbitOf(wave: Waveform, step = 1 / 8192): Orbit {
  const times: number[] = [];
  const angles: number[] = [];
  let unwrapped = 0;
  let last: number | null = null;
  for (let t = wave.start; t <= Math.min(0, wave.end); t += step) {
    const { plus, cross } = wave.at(t);
    const phase = Math.atan2(cross, plus);
    unwrapped += turnBetween(last ?? phase, phase);
    last = phase;
    times.push(t);
    angles.push(unwrapped / 2);
  }
  // The first pitch the wave gives, where it is loud enough for one to be read.
  let first = 0;
  for (let t = wave.start; first <= 0 && t < 0; t += step * 8) first = wave.frequency(t);
  if (first <= 0) first = 1;
  return {
    two: (t) => t < 0,
    angle(t) {
      const index = Math.min(times.length - 1, Math.max(0, Math.round((t - wave.start) / step)));
      return angles[index] ?? 0;
    },
    separation(t) {
      const pitch = wave.frequency(Math.min(t, 0));
      if (pitch <= 0) return t < 0 ? 1 : 0;
      return (pitch / first) ** (-2 / 3);
    },
  };
}
