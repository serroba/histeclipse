/**
 * The Years bar's round marks (#749): round historical years between its ends, as few or as
 * many as the years shown hold.
 */

import { astronomicalYear, formatYear } from '../../time/year';
import { END_ROOM, roundStep, type Tick } from '../../ui/periodBands';

/**
 * The years' round marks: round historical years (8000 BCE, 6000 BCE… 2000 CE), which have no
 * year 0, between a slider's ends given in Ma before 1950.
 */
export function yearTicks(oldest: number, youngest: number): Tick[] {
  const yearOf = (ma: number): number => 1950 - ma * 1e6;
  const first = yearOf(oldest);
  const last = yearOf(youngest);
  const step = roundStep(last - first, 6);
  const ticks: Tick[] = [];
  for (let count = Math.ceil(first / step); count * step <= last; count += 1) {
    // Counted as historians count: 2000 BCE is astronomical year -1999.
    const historical = count * step;
    if (historical === 0) continue;
    const astronomical = historical < 0 ? historical + 1 : historical;
    const ma = (1950 - astronomical) / 1e6;
    const share = (oldest - ma) / (oldest - youngest);
    if (share < END_ROOM || share > 1 - END_ROOM) continue;
    // Without the CE everyone assumes, as the track's ends are written.
    ticks.push({ ma, label: formatYear(astronomicalYear(astronomical)).replace(/ CE$/, '') });
  }
  return ticks;
}
