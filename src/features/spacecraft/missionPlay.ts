/**
 * A mission played on the bar (#712): its chapters as the bar's moments, and the paces it can
 * play at, fitted to its length: a week to the Moon and back, or twelve years to Neptune, each
 * in under a minute and a half by default, slower or faster a choice away.
 */

import type { Mission } from '../../data/spacecraftMission';
import type { DayMoment } from '../../ui/dayTrack';
import { launchDate } from './launchList';

/** Hours a second a mission can play at: an hour a second to 200 days a second. */
const PACES = [1, 2, 3, 6, 12, 24, 48, 120, 240, 480, 1200, 2400, 4800] as const;
/** Seconds the whole of a mission takes at its pace, about. */
const SECONDS = 45;
/** Shorter than this, days, a mission's moments name the time of day as well. */
const SHORT_DAYS = 30;

/** "20 Jul 1969, 20:17 UT" for a short mission; "20 Aug 1977" for a long one. */
function chapterDate(jd: number, short: boolean): string {
  const day = launchDate(jd);
  if (!short) return day;
  const time = new Date((jd - 2_440_587.5) * 86_400_000).toISOString().slice(11, 16);
  return `${day}, ${time} UT`;
}

/** A mission's chapters as the bar's moments. */
export function missionMoments(mission: Mission): readonly DayMoment[] {
  const short = mission.end - mission.start < SHORT_DAYS;
  return mission.chapters.map(({ name, meaning, jd }) => ({
    name,
    meaning,
    jd,
    date: chapterDate(jd, short),
  }));
}

/**
 * The paces a mission plays at, hours a second: the one that plays the whole of it in about
 * `SECONDS` (not faster), first, and slower and faster beside it, slowest first.
 */
export function missionPaces(mission: Mission): { fitted: number; paces: readonly number[] } {
  const wanted = ((mission.end - mission.start) * 24) / SECONDS;
  let index = 0;
  PACES.forEach((pace, k) => {
    if (pace <= wanted) index = k;
  });
  const from = Math.max(0, Math.min(index - 1, PACES.length - 4));
  return { fitted: PACES[index] ?? 1, paces: PACES.slice(from, from + 4) };
}
