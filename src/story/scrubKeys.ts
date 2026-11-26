/**
 * Where a key takes a chart's cursor, 0 to 1 across (`chartScrubber.ts`): the arrows a small
 * step, about a pixel or two on a wide chart, or with Shift a leap; Page keys a leap; Home and
 * End the ends. Null for any other key.
 */

const STEP = 0.004;
const LEAP = 0.05;

export function scrubKey(key: string, shift: boolean, current: number): number | null {
  const step = shift ? LEAP : STEP;
  const moves: Readonly<Record<string, number>> = {
    ArrowLeft: current - step,
    ArrowDown: current - step,
    ArrowRight: current + step,
    ArrowUp: current + step,
    PageDown: current - LEAP,
    PageUp: current + LEAP,
    Home: 0,
    End: 1,
  };
  const next = moves[key];
  return next === undefined ? null : Math.min(1, Math.max(0, next));
}
