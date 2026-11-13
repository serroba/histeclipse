/**
 * The small sums every animation times its moves with (#338, #602): easing, clamping, and how far
 * through a span a moment is. Story scenes and the globe's animations share them.
 */

/** Eases in and out, quadratically: slow at both ends, `x` from 0 to 1. */
export function ease(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
}

/** Eases out, cubically: fast at first, settling at the end, `x` from 0 to 1. */
export function easeOut(x: number): number {
  return 1 - (1 - x) ** 3;
}

/** `x`, held between 0 and 1. */
export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** How far through the span from `from` to `to` the moment `t` is, from 0 to 1. */
export function within(t: number, from: number, to: number): number {
  return clamp01((t - from) / (to - from));
}

/** How far through the `length` from `from` the moment `t` is, from 0 to 1. */
export function through(t: number, from: number, length: number): number {
  return clamp01((t - from) / length);
}
