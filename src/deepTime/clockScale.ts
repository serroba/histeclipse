/**
 * An event's own clock (#1173, #1191): how its slider maps to time since the event, how fast it
 * plays, the marks under it and what it says. Chicxulub's runs on log seconds from the strike
 * (`strikeClock.ts`); the end-Permian, with no instant to count from, runs linearly across its
 * crisis and on a log tail through the recovery (`crisisClock.ts`).
 *
 * Pure.
 */

import type { Pace } from './playSpeed';

export interface ClockScale {
  /** The slider's last position; its first is 0. */
  readonly end: number;
  /** Seconds since the event (negative before it) at `position` on the slider. */
  readonly secondsAt: (position: number) => number;
  /** Where on the slider `seconds` since the event is. */
  readonly positionAt: (seconds: number) => number;
  /** How far along the slider play moves from `position` in `seconds` of play at `pace`. */
  readonly advance: (pace: Pace, seconds: number, position: number) => number;
  /** A slider step by key. */
  readonly step: number;
  /** The marks under the slider: seconds since the event, and their label. */
  readonly marks: readonly (readonly [number, string])[];
  /** What the clock says at `seconds` since the event. */
  readonly text: (seconds: number) => string;
  /** What the slider is, to a screen reader. */
  readonly label: string;
  /** How the slider runs, in a line under it: its steps are not all alike (#1224). */
  readonly hint: string;
}
