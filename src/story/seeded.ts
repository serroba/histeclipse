/**
 * A seeded random number from 0 to 1 (Park and Miller's minimal standard): the same sequence
 * for the same seed, so the story draws the same walk, shower and air every time.
 */
export function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}
