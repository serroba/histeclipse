/**
 * The wave as it is played (#829): a fifth of a second slowed a hundred times, its strain of
 * 10⁻²¹ stretched 4 × 10²⁰ times, so a ring a metre across would sway by a fifth of itself. It
 * loops: a still moment, the chirp and the ringdown, a rest, again. Behind the ring, the wave is
 * drawn coming through space as a stack of sheets, each met by the wave a little later, at a
 * speed that makes its wavelength the stack's size: not to scale either.
 *
 * Pure: no DOM, no three.js.
 */

import type { Polarisations, Waveform } from './strain';

/** How many times slower than it was. */
export const SLOWED = 100;
/** How many times its strain is stretched to be seen. */
export const EXAGGERATION = 4e20;
/** The still moments before the wave arrives and after it has gone, ms. */
const LEAD_MS = 1200;
const REST_MS = 2200;

/** How long one play of it lasts, ms. */
export function loopMs(wave: Waveform): number {
  return LEAD_MS + (wave.end - wave.start) * SLOWED * 1000 + REST_MS;
}

/** The wave's own time, s from the merger, `ms` into playing it (looping). */
export function waveTimeAt(wave: Waveform, ms: number): number {
  const into = ((ms % loopMs(wave)) + loopMs(wave)) % loopMs(wave);
  return wave.start + (into - LEAD_MS) / (SLOWED * 1000);
}

/** When, ms into playing, the merger is: what a still drawing shows. */
export function mergerMs(wave: Waveform): number {
  return LEAD_MS - wave.start * SLOWED * 1000;
}

/** The strain as drawn: the wave's, stretched. */
export function drawnStrain(wave: Waveform, t: number): Polarisations {
  const { plus, cross } = wave.at(t);
  return { plus: plus * EXAGGERATION, cross: cross * EXAGGERATION };
}

/**
 * The stack of sheets the wave comes through: their depths, the first at the ring, the rest
 * behind it, and the speed the wave is drawn at between them, scene units per second of the
 * wave's own time, so that at `pitch` Hz a wavelength spans the stack.
 */
export function sheets(
  count: number,
  depth: number,
  pitch = 100,
): { readonly depths: readonly number[]; readonly speed: number } {
  if (count < 2) throw new Error('a stack needs two sheets');
  const depths = Array.from({ length: count }, (_, index) => (-depth * index) / (count - 1));
  return { depths, speed: depth * pitch };
}

/** The strain each sheet has at the wave's time `t`: met later the farther along it lies. */
export function strainOfSheets(
  wave: Waveform,
  t: number,
  stack: ReturnType<typeof sheets>,
): Polarisations[] {
  // The wave goes toward +z, the reader's side: a sheet at depth z met it (0 − z)/speed earlier.
  return stack.depths.map((z) => drawnStrain(wave, t + z / stack.speed));
}

/** Where the wave is, in words: before the merger, at it, or ringing down after. */
export function momentText(wave: Waveform, t: number): string {
  if (t < wave.start) return 'Space at rest: the wave has not arrived.';
  if (t > wave.end) return 'Space at rest again: the wave has passed.';
  const hertz = Math.round(wave.frequency(t));
  // Where the wave is too faint for its pitch to be read, none is given.
  const pitch = hertz > 0 ? ` · ${String(hertz)} Hz` : '';
  if (t < -0.0005) return `${(-t).toFixed(3)} s before the merger${pitch}`;
  if (t <= 0.0005) return `The merger${pitch}`;
  return `Ringing down, ${t.toFixed(3)} s after${pitch}`;
}
