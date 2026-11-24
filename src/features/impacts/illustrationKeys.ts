/**
 * The shared keys for a crater card's illustration (#807): while it plays and deep time does
 * not, Space holds it still or lets it play on, and the arrows step it back and on, holding it.
 * It comes before what is on the page, as a story does: the deep-time bar under it waits.
 */

import type { PlayedImpact } from '../../globe/heldStrikes';
import type { KeyPlayer } from '../../ui/playKeys';

/** A step of the arrows, and a leap with Shift, in the illustration's time (ms). */
export const STEP_MS = 250;
export const LEAP_MS = 2000;

export function illustrationKeys(
  current: () => PlayedImpact | null,
  deepPlaying: () => boolean,
): KeyPlayer {
  return {
    shown: () => current()?.playing() === true && !deepPlaying(),
    toggle() {
      const playing = current();
      playing?.hold(!playing.held());
    },
    step(direction, leap) {
      const playing = current();
      if (playing === null) return;
      playing.hold(true);
      playing.step(direction * (leap ? LEAP_MS : STEP_MS));
    },
    over: true,
  };
}
