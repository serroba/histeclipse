/**
 * Lingering at the moments that matter (#1267): as a clock plays onto one of its key moments,
 * play stops there and creeps on at a fraction of its pace for a few seconds, so what is said
 * there can be read, then goes on. Only the play slows: the slider, the moment it says and the
 * dates stay on their true scale, and the clock says it has slowed to read.
 *
 * Each key moment is lingered at once as play passes it. Moved by the reader, by the slider or
 * by opening it somewhere, the key moments ahead are lingered at again.
 *
 * Pure but for its own count of what it has lingered at.
 */

/** How long play lingers at a key moment, seconds. */
export const LINGER_SECONDS = 4;
/** The share of its pace play keeps while it lingers. */
export const LINGER_PACE = 0.15;

export interface Linger {
  /**
   * Play would move `delta` along the slider from `position` in `seconds`: how far it moves,
   * and whether it is lingering.
   */
  step(position: number, delta: number, seconds: number): { delta: number; lingering: boolean };
}

/** Lingering at the slider positions `keys`. */
export function createLinger(keys: readonly number[]): Linger {
  let passed = new Set<number>();
  let left = 0;
  // Where play left it last: anywhere else, the reader moved it.
  let expected: number | null = null;
  return {
    step(position, delta, seconds) {
      if (position !== expected) {
        passed = new Set(keys.filter((key) => key < position));
        left = 0;
      }
      let moved = delta;
      if (left > 0) {
        left -= seconds;
        moved = delta * LINGER_PACE;
      } else {
        const reached = keys.find((key) => !passed.has(key) && key <= position + delta);
        if (reached !== undefined) {
          passed.add(reached);
          left = LINGER_SECONDS;
          moved = Math.max(0, reached - position);
        }
      }
      expected = position + moved;
      return { delta: moved, lingering: left > 0 };
    },
  };
}
