/**
 * The small sums every story scene times its moves with (#338): easing, clamping, and how far
 * through a span a moment is.
 */

/** Eases in and out, quadratically: slow at both ends, `x` from 0 to 1. */
export function ease(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
}

/** `x`, held between 0 and 1. */
export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** How far through the span from `from` to `to` the moment `t` is, from 0 to 1. */
export function within(t: number, from: number, to: number): number {
  return clamp01((t - from) / (to - from));
}
