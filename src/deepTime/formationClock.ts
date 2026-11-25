/**
 * The formation clock (#1218): Earth and the Moon forming, as the aeons begin. Its slider runs in
 * three parts:
 * - log time since the Solar System's first solids, a unit each tenfold, from 10,000 years to
 *   the giant impact;
 * - Theia coming in, the last hours before it, a unit;
 * - log time since the impact, a unit each tenfold, from an hour to 10 million years, by when the
 *   first ocean has formed and the Moon's magma ocean is mostly crust.
 *
 * When the impact struck is argued, so the clock is made for the date the reader has chosen.
 * Like the other clocks, it counts seconds since its event, the impact; deep time's moment at
 * each is `formationMa`.
 *
 * Pure.
 */

import type { ClockScale } from './clockScale';
import type { Pace } from './playSpeed';
import { durationText } from './strikeClock';

const HOUR = 3600;
const YEAR = 365.25 * 86_400;
const MYR = 1e6 * YEAR;

/** The Solar System's first solids, Ma: 4,567.30 ± 0.16 (Connelly et al. 2012). */
export const FIRST_SOLIDS_MA = 4567.3;
/** Where the clock starts, after the first solids: 10,000 years. */
const FIRST = 1e4 * YEAR;
/** Theia coming in: how long before the impact the approach starts. */
export const APPROACH = 6 * HOUR;
/** The clock's end, after the impact. */
export const AFTER = 10 * MYR;

/** Slider units a second at each pace: the whole in about a minute, 21 s or 8 s. */
const UNITS_PER_SECOND: Readonly<Record<Pace, number>> = { slow: 0.25, normal: 0.75, fast: 2 };

/** Seconds since the impact at `ma`, an impact at `impactMa`. */
export function formationSeconds(impactMa: number, ma: number): number {
  return (impactMa - ma) * MYR;
}

/** Deep time's moment, Ma, `seconds` after an impact at `impactMa`. */
export function formationMa(impactMa: number, seconds: number): number {
  return impactMa - seconds / MYR;
}

function text(seconds: number, sinceSolids: number): string {
  if (seconds < -APPROACH) return `${durationText(sinceSolids)} after the first solids`;
  if (Math.abs(seconds) < 1) return 'The impact';
  return seconds < 0
    ? `${durationText(seconds)} before the impact`
    : `${durationText(seconds)} after the impact`;
}

/** The formation clock for an impact at `impactMa`. */
export function formationScale(impactMa: number): ClockScale {
  // From the first solids to the impact.
  const before = (FIRST_SOLIDS_MA - impactMa) * MYR;
  // Where the approach begins and where the impact is, on the slider.
  const approachAt = Math.log10((before - APPROACH) / FIRST);
  const impactAt = approachAt + 1;
  const end = impactAt + Math.log10(AFTER / HOUR + 1);
  const secondsAt = (position: number): number => {
    const at = Math.min(end, Math.max(0, position));
    if (at < approachAt) return FIRST * 10 ** at - before;
    if (at < impactAt) return -APPROACH * (impactAt - at);
    return HOUR * (10 ** (at - impactAt) - 1);
  };
  const positionAt = (seconds: number): number => {
    if (seconds > 0) return Math.min(end, impactAt + Math.log10(seconds / HOUR + 1));
    if (seconds >= -APPROACH) return impactAt + seconds / APPROACH;
    // Before the clock's start, even before the first solids (deep time begins at 4,568 Ma): 0.
    const since = seconds + before;
    return since <= FIRST ? 0 : Math.log10(since / FIRST);
  };
  return {
    end,
    secondsAt,
    positionAt,
    advance: (pace, seconds) => UNITS_PER_SECOND[pace] * seconds,
    // A tenth of a tenfold.
    step: 0.1,
    marks: [
      [secondsAt(0), 'First solids'],
      [1 * MYR - before, '1 Myr'],
      [0, 'Impact'],
      [1000 * YEAR, '1,000 years'],
      [AFTER, '10 Myr'],
    ],
    text: (seconds) => text(seconds, seconds + before),
    label: 'Time since the first solids, then since the giant impact: tenfolds',
    hint: 'Each step is ten times longer than the one before: up to the impact counted from the first solids, then from the impact, hours to millions of years.',
  };
}
