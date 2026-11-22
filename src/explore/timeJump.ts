/**
 * Going to a moment typed (#730): a year of the last 11,700 years opens in the years, on the
 * reader's day and hour of the year; an older year, or any age, opens in deep time on the
 * narrowest range that draws it. Where the camera looks and what is drawn stay as they were.
 * Nothing is interpolated across ranges: each moment opens where its own data is.
 */

import type { TimeEntry } from '../time/timeEntry';
import { frameSpan } from './frame';

/** The oldest year the years range shows (9700 BCE), as `t` takes it. */
const OLDEST_YEAR = -9699;

/** What going to a moment replaces in a link: when, and on which range. */
// The bar's windows too (#1078): a jump shows its span whole, as a preset does.
const TIMED = ['t', 'cal', 'ma', 'scale', 'mission', 'dw', 'yw'];

const pad = (value: number, width: number): string => String(Math.abs(value)).padStart(width, '0');

/** A year as a link writes it: -0043, 1969. */
function yearText(year: number): string {
  return `${year < 0 ? '-' : ''}${pad(year, 4)}`;
}

/** Millions of years, to a thousand years, without trailing zeros. */
function maText(ma: number): string {
  return String(Math.round(ma * 1000) / 1000);
}

/**
 * The link going to `entry` gives: the reader's, with its moment and range replaced. `current`
 * is the reader's link, `present` this year. A year keeps the reader's day and hour, so the
 * season and the sky stay; without one, midsummer noon.
 */
export function jumpQuery(entry: TimeEntry, current: string, present: number): string {
  const params = new URLSearchParams(current);
  const monthDayTime = /(\d\d-\d\dT\d\d:\d\d)Z?$/.exec(params.get('t') ?? '')?.[1] ?? '07-01T12:00';
  for (const key of TIMED) params.delete(key);
  if (entry.kind === 'year' && entry.year >= OLDEST_YEAR) {
    params.set('t', `${yearText(entry.year)}-${monthDayTime}Z`);
  } else {
    const ma = entry.kind === 'ma' ? entry.ma : (present - entry.year) / 1e6;
    params.set('ma', maText(ma));
    const span = frameSpan({ kind: 'ma', from: ma, to: ma });
    if (span !== 'years') params.set('scale', span);
  }
  return params.toString().replaceAll('%2C', ',').replaceAll('%3A', ':');
}
