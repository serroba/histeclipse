/** How a checked observation reads: what the tablet says, what the sky shows, and when. */

import { calendarDate, julianDayNumber } from '../time/julianDay';
import { formatYear, astronomicalYear } from '../time/year';
import type { Verdict } from './check';
import { FINGERS_PER_CUBIT } from './tabletSky';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RD_TO_JD = 1_721_424.5;

/** "1 cubit 4 fingers", "⅔ cubit" style, from cubits: whole cubits and the fingers left over. */
export function cubitsText(cubits: number): string {
  const fingers = Math.round(Math.abs(cubits) * FINGERS_PER_CUBIT);
  const whole = Math.floor(fingers / FINGERS_PER_CUBIT);
  const left = fingers % FINGERS_PER_CUBIT;
  const parts = [
    whole === 0 ? null : `${String(whole)} cubit${whole === 1 ? '' : 's'}`,
    left === 0 ? null : `${String(left)} finger${left === 1 ? '' : 's'}`,
  ].filter((part) => part !== null);
  return parts.length === 0 ? '0 fingers' : parts.join(' ');
}

/** "8 Jun 568 BCE": a civil date (fixed day), Julian calendar. */
export function civilDateText(fixedDay: number): string {
  const date = calendarDate(julianDayNumber(fixedDay + RD_TO_JD + 0.5), 'julian');
  return `${String(Math.floor(date.day))} ${MONTHS[date.month - 1] ?? ''} ${formatYear(astronomicalYear(date.year))}`;
}

/** What the computed sky gives, in the record's own terms. */
export function computedText(verdict: Verdict): string {
  const { observation, computed } = verdict;
  if (observation.kind === 'leap') {
    return verdict.fits
      ? `the year before had ${observation.previousLeap}`
      : 'the year before had no second Addaru';
  }
  if (computed === null) return 'not seen that day';
  if (observation.kind === 'lunar six') return `${computed.toFixed(1)} UŠ`;
  if (observation.relation === 'near') return `${cubitsText(computed)} away`;
  const opposite: Record<string, string> = {
    'in front of': 'behind',
    behind: 'in front of',
    above: 'below',
    below: 'above',
  };
  const relation = computed >= 0 ? observation.relation : (opposite[observation.relation] ?? '');
  return `${cubitsText(computed)} ${relation}`;
}

/** What the tablet records, in the same terms. */
export function recordedText(verdict: Verdict): string {
  const { observation } = verdict;
  if (observation.kind === 'leap') return `the year before had ${observation.previousLeap}`;
  if (observation.kind === 'lunar six') return `${String(observation.us)} UŠ`;
  if (observation.relation === 'near') return 'within the cluster';
  return observation.cubits === undefined
    ? observation.relation
    : `${cubitsText(observation.cubits)} ${observation.relation}`;
}
