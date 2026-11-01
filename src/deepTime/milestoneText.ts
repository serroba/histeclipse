/** Wording for milestone estimates: their age ranges and how firm the numbers are. */

import type { Basis } from './milestones';

/** "66.043 Ma", "50.6–52.8 Ma", or for the last million years "281,000–349,000 years ago". */
export function formatRange(min: number, max: number): string {
  if (max < 1) {
    const years = (ma: number): string => Math.round(ma * 1e6).toLocaleString('en');
    return min === max ? `${years(min)} years ago` : `${years(min)}–${years(max)} years ago`;
  }
  // Up to three decimals, as precise as the source; no trailing zeros.
  const ma = (value: number): string => value.toLocaleString('en', { maximumFractionDigits: 3 });
  return min === max ? `${ma(min)} Ma` : `${ma(min)}–${ma(max)} Ma`;
}

/** How the number was got, for estimates whose source does not state it outright. */
export function basisNote(basis: Basis): string | null {
  switch (basis) {
    case 'stated':
      return null;
    case 'stage':
      return 'the source names a geological stage; the range is that stage’s';
    case 'secondary':
      return 'the source’s number, as quoted by a later paper';
  }
}
