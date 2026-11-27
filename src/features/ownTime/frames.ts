/**
 * A clock's frames on a struggling device (#1267's CI, a phone, software graphics): after a slow
 * frame, the next waits as long as it took, so playing leaves the page time to keep up.
 */

/**
 * A frame slower than this, ms (under 20 a second), means the device is struggling (a phone, or
 * software graphics, where each frame of the globe takes long to draw): the next waits as long
 * as this one took, so playing takes at most half of the page's time and it stays responsive.
 */
const SLOW_FRAME = 50;
/** The longest such wait, ms. */
const LONGEST_WAIT = 500;

/**
 * Ask for `tick` after a frame that came `cost` ms after the last: at once, or after a slow one,
 * as long as it took (as the currents' streaks do, #927). Each frame moves the clock on by at
 * most a fifth of a second of play, so a struggling device plays it slower, never skipping.
 * Returns how to cancel it.
 */
export function askFrame(tick: FrameRequestCallback, cost: number): () => void {
  let id: number | null = null;
  const ask = (): void => {
    id = requestAnimationFrame(tick);
  };
  if (cost <= SLOW_FRAME) ask();
  const timer = cost > SLOW_FRAME ? setTimeout(ask, Math.min(LONGEST_WAIT, cost)) : null;
  return () => {
    if (timer !== null) clearTimeout(timer);
    if (id !== null) cancelAnimationFrame(id);
  };
}
