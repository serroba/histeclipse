/**
 * Deep time played along another part's own timeline while it shows (#1276): the temperature
 * chart over the ice ages gives each of its panels screen time, where play at one speed in years
 * would pass the last 20,000 years in a blink. The pace control scales it as it scales play.
 */

/** A timeline play follows: where a moment is along it, and back, at the Normal pace. */
export interface PlayAxis {
  /** Where `ma` is along it: seconds from its start at the Normal pace. */
  at(ma: number): number;
  /** The moment `seconds` along it: `at` read back. */
  ma(seconds: number): number;
  /** Where play has reached, unrounded, each frame: finer than the thousand years kept. */
  follow(ma: number): void;
  /** Play reached the bar's young end along it. */
  ended(): void;
}

/** How far ahead the speed is measured, seconds along the axis. */
const AHEAD = 0.25;

/** Ma a second along `axis` at `ma`, at `share` of the Normal pace: what the bar says of it. */
export function speedAlong(axis: Pick<PlayAxis, 'at' | 'ma'>, ma: number, share: number): number {
  return (Math.max(0, ma - axis.ma(axis.at(ma) + AHEAD)) / AHEAD) * share;
}
