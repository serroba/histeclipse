/**
 * How fast deep time plays, chosen per span: each span has its own few speeds, in the units that
 * suit it, from a slow look to a quick sweep.
 */

import type { DeepScale } from '../state/viewState';

/** Millions of years a second each span can play at, slowest first. */
export const DEEP_SPEEDS: Readonly<Record<DeepScale, readonly number[]>> = {
  // The ice ages: 1,000 to 200,000 years a second (a glacial cycle in 100 s; 2.6 million
  // years in 13 s at the fastest).
  ice: [0.001, 0.01, 0.05, 0.2],
  // 540 million years: 5 to 50 million years a second (in 2 minutes to 11 s).
  all: [5, 20, 50],
  // All of Earth's 4.6 billion years: 25 to 250 million years a second (3 minutes to 18 s).
  eons: [25, 100, 250],
};

/** The speed each span starts at: the middle one. */
export const DEFAULT_DEEP_SPEED: Readonly<Record<DeepScale, number>> = {
  ice: 0.05,
  all: 20,
  eons: 100,
};

/** The speed, short, in geology's units: "50 kyr/s", "20 Myr/s". */
export function deepSpeedText(maPerSecond: number): string {
  if (maPerSecond < 1) return `${String(Math.round(maPerSecond * 1000))} kyr/s`;
  return `${maPerSecond.toLocaleString('en')} Myr/s`;
}

/** The speed in words, for a reader's tooltip: "50,000 years a second". */
export function deepSpeedWords(maPerSecond: number): string {
  return maPerSecond < 1
    ? `${Math.round(maPerSecond * 1e6).toLocaleString('en')} years a second`
    : `${maPerSecond.toLocaleString('en')} million years a second`;
}

/** The speed asked for, if the span offers it; else the span's own. */
export function deepSpeedFor(scale: DeepScale, wanted: number | undefined): number {
  return wanted !== undefined && DEEP_SPEEDS[scale].includes(wanted)
    ? wanted
    : DEFAULT_DEEP_SPEED[scale];
}
