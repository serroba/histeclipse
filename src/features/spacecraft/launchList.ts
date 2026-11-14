/**
 * The launches the bar plays through (#702): one for each rocket that sent craft beyond Earth
 * orbit, from the record's first (Luna 1, January 1959), named by the craft it carried, a
 * capsule or lander riding with its craft counted with it.
 */

import type { Craft } from '../../data/spacecraft';
import { shortDate } from '../../time/calendars';
import { calendarDate, historicalCalendar, julianDayNumber } from '../../time/julianDay';
import type { DayMoment } from '../../ui/dayTrack';
import { gcatJd } from './approximatePaths';

/** Most craft named on one launch's chip; the rest are counted. */
const MOST_NAMED = 2;

/** A launch's day as written: "2 Jan 1959". */
export function launchDate(jdUT: number): string {
  const jd = julianDayNumber(jdUT);
  const { year } = calendarDate(jd, historicalCalendar(jd));
  return `${shortDate('western', jd)} ${String(year)}`;
}

/** Each launch, earliest first: when (UT), the craft it sent named, and what they set out to do. */
export function launchMoments(craft: readonly Craft[]): readonly DayMoment[] {
  const byLaunch = new Map<string, Craft[]>();
  for (const each of craft) {
    const sent = byLaunch.get(each.launchTag);
    if (sent === undefined) byLaunch.set(each.launchTag, [each]);
    else sent.push(each);
  }
  const moments = [...byLaunch.values()].map((sent) => {
    // A part (a capsule, a lander) is named with the craft that carried it, unless it is all.
    const main = sent.filter((each) => !each.part);
    const named = (main.length > 0 ? main : sent).map((each) => each.mission ?? each.name);
    const unique = [...new Set(named)];
    const more = unique.length - MOST_NAMED;
    const name =
      unique.slice(0, MOST_NAMED).join(', ') + (more > 0 ? ` and ${String(more)} more` : '');
    const first = main[0] ?? sent[0];
    const jd = gcatJd(first?.launch ?? '2000');
    return { name, meaning: first?.about ?? name, jd, date: launchDate(jd) };
  });
  return moments.sort((a, b) => a.jd - b.jd);
}
