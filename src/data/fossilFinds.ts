/**
 * One genus's finds, or a group of genera's, from the lines through time (#309): to ring on the
 * globe at a moment, and to open at. Each find is at its 5-million-year step, as the lines keep it.
 */

import { isGenus, isWithin, type Lineages, type TrackPoint } from './lineages';

/** Every find of a genus, or of every genus within a group, each at its step (#309). */
export function findsOf(lineages: Lineages, index: number): readonly TrackPoint[] {
  return lineages.nodes.flatMap((node) =>
    isGenus(node) && isWithin(lineages, node.index, index) ? node.track : [],
  );
}

export interface FindsAt {
  /** Its sites in the step at `ma`, as the map's (centred on a multiple of the step). */
  readonly sites: readonly TrackPoint[];
  /** With none then, the nearest step that has some, the older on a tie; else null. */
  readonly nearest: number | null;
}

/** Where finds lay at `ma`, or, with none then, the nearest moment they lay anywhere (#309). */
export function findsAt(finds: readonly TrackPoint[], ma: number, stepMa: number): FindsAt {
  const step = Math.round(ma / stepMa) * stepMa;
  const sites = finds.filter((point) => point.ma === step);
  if (sites.length > 0) return { sites, nearest: null };
  let nearest: number | null = null;
  for (const { ma: at } of finds) {
    const nearer =
      nearest === null ||
      Math.abs(at - ma) < Math.abs(nearest - ma) ||
      (Math.abs(at - ma) === Math.abs(nearest - ma) && at > nearest);
    if (nearer) nearest = at;
  }
  return { sites, nearest };
}

/** The oldest step with finds, at its site with the most (#309): where to open them; else null. */
export function oldestFinds(finds: readonly TrackPoint[]): TrackPoint | null {
  let oldest: TrackPoint | null = null;
  for (const site of finds) {
    const better =
      oldest === null ||
      site.ma > oldest.ma ||
      (site.ma === oldest.ma && site.finds > oldest.finds);
    if (better) oldest = site;
  }
  return oldest;
}
