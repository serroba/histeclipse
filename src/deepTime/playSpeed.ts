/**
 * How fast deep time plays (#1076): at a pace, not a speed. Each pace sweeps the bar in about the
 * same time whatever part of time it shows, so zooming in plays slower and out faster: Normal
 * in about 20 seconds, Slow in two minutes, Fast in six seconds. The speed follows, rounded to
 * one easy to read (1, 2 or 5 × 10ⁿ years a second), and is said beside the pace.
 */

export const PACES = ['slow', 'normal', 'fast'] as const;
export type Pace = (typeof PACES)[number];

/** The pace play starts at. */
export const DEFAULT_PACE: Pace = 'normal';

/** The pace's name, as offered. */
export const PACE_LABELS: Readonly<Record<Pace, string>> = {
  slow: 'Slow',
  normal: 'Normal',
  fast: 'Fast',
};

/** Seconds a sweep of the bar takes at each pace. */
const SWEEP_SECONDS: Readonly<Record<Pace, number>> = { slow: 120, normal: 20, fast: 6 };

/** The slowest deep time plays: a hundred years a second. */
const SLOWEST = 0.0001;

/** The speed, Ma a second, that sweeps a bar `windowMa` long at `pace`, rounded to read. */
export function paceSpeed(windowMa: number, pace: Pace): number {
  const raw = Math.max(SLOWEST, windowMa / SWEEP_SECONDS[pace]);
  const power = 10 ** Math.floor(Math.log10(raw));
  const mantissa = raw / power;
  const step = mantissa < 1.5 ? 1 : mantissa < 3.5 ? 2 : mantissa < 7.5 ? 5 : 10;
  // To six figures, so 0.1 × 3 does not show as 0.30000000000000004.
  return Number((step * power).toPrecision(6));
}

/** The speed, short, in geology's units: "≈ 50 kyr/s", "20 Myr/s", "500 yr/s". */
export function deepSpeedText(maPerSecond: number): string {
  if (maPerSecond < 0.001) return `${Math.round(maPerSecond * 1e6).toLocaleString('en')} yr/s`;
  if (maPerSecond < 1) return `${String(Math.round(maPerSecond * 1000))} kyr/s`;
  return `${maPerSecond.toLocaleString('en')} Myr/s`;
}

/** The speed in words, for a reader's tooltip: "50,000 years a second". */
export function deepSpeedWords(maPerSecond: number): string {
  return maPerSecond < 1
    ? `${Math.round(maPerSecond * 1e6).toLocaleString('en')} years a second`
    : `${maPerSecond.toLocaleString('en')} million years a second`;
}

/**
 * Maps loaded ahead while deep time plays: at 20 Myr a second, about a second's worth; more at
 * a faster speed, so the globe keeps up.
 */
export function prefetchFrames(maPerSecond: number): number {
  return Math.max(4, Math.ceil((4 * maPerSecond) / 20));
}
