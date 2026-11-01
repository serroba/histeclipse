/**
 * Which sea level the ice-age coastlines follow. The reader picks a reconstruction; where it
 * does not reach the moment shown, the first that does stands in, and the bar says so. Each is
 * measured from its own present-day value, so today's coasts are today's: Spratt & Lisiecki's
 * stack reads about +9 m at 0 ka.
 */

import { seaLevelAt, type SeaLevelIndex, type SeaLevelSeries } from '../data/seaLevel';

/** The reconstructions coastlines can follow, in order of preference when one does not reach. */
export const COAST_SOURCES = ['bintanja-2008', 'spratt-2016'] as const;
export type CoastSource = (typeof COAST_SOURCES)[number];
export const DEFAULT_COAST: CoastSource = 'bintanja-2008';

export interface Coastline {
  /** Metres from today's sea level, measured from the source's own present-day value. */
  readonly seaLevel: number;
  readonly series: SeaLevelSeries;
  /** The source asked for, when another stands in because it does not reach. */
  readonly instead: SeaLevelSeries | null;
}

export function coastlineAt(
  index: SeaLevelIndex,
  wanted: CoastSource,
  ka: number,
): Coastline | null {
  const byId = (id: string): SeaLevelSeries | undefined =>
    index.series.find((series) => series.id === id);
  const asked = byId(wanted);
  for (const id of [wanted, ...COAST_SOURCES.filter((other) => other !== wanted)]) {
    const series = byId(id);
    if (series === undefined) continue;
    const then = seaLevelAt(series, ka);
    const now = seaLevelAt(series, 0);
    if (then === null || now === null) continue;
    return {
      seaLevel: then.level - now.level,
      series,
      instead: series === asked || asked === undefined ? null : asked,
    };
  }
  return null;
}
