/**
 * Contextual text (#391): the passages anchored where the reader is looking, at the moment
 * shown. A passage counts on the body in view, inside the disc the camera sees, nearer the
 * middle of the view and nearer the moment the better; one tied to the body alone (a moon's
 * story) counts as if halfway out. One two thousand years from the moment is not here. The
 * whys are left to the Sources list, which already has them.
 */

import type { Anchor, Passage } from './passages';

/** Where the reader looks: the body, the point under the camera, how far off, and when. */
export interface Here {
  readonly body: string;
  readonly target: { readonly latitude: number; readonly longitude: number };
  /** The camera's distance from the body's centre, in its radii. */
  readonly distance: number;
  /** The astronomical year shown; null in deep time, which no passage reaches yet. */
  readonly year: number | null;
}

export interface Near {
  readonly passage: Passage;
  /** The anchor that brought it here. */
  readonly anchor: Anchor;
  readonly score: number;
}

/** Years a moment can be from a passage's own and still count half. */
const HALF_YEARS = 100;
/** Less than this and it is not here: some 1,900 years off at the middle of the view; 900 for
 * a passage tied to the body alone. */
const LEAST_FIT = 0.05;

const RADIANS = Math.PI / 180;

/** The angle between two points on a sphere, degrees. */
function apart(
  [lat, lon]: readonly [number, number],
  { latitude, longitude }: Here['target'],
): number {
  const cos =
    Math.sin(lat * RADIANS) * Math.sin(latitude * RADIANS) +
    Math.cos(lat * RADIANS) * Math.cos(latitude * RADIANS) * Math.cos((lon - longitude) * RADIANS);
  return Math.acos(Math.min(1, Math.max(-1, cos))) / RADIANS;
}

/** How well an anchor fits where and when the reader is: 0 (not here) to 1. */
function fit(anchor: Anchor, here: Here): number {
  if (anchor.body !== here.body) return 0;
  // The disc the camera sees reaches this far from the point under it.
  const seen = Math.acos(1 / Math.max(1.0001, here.distance)) / RADIANS;
  let place = 0.5;
  if (anchor.at !== undefined) {
    const off = apart(anchor.at, here.target);
    if (off >= seen) return 0;
    place = 1 - off / seen;
  }
  if (anchor.when === undefined) return place;
  if (here.year === null) return 0;
  const [from, to] = anchor.when;
  const gap = Math.max(0, from - here.year, here.year - to);
  return place / (1 + gap / HALF_YEARS);
}

/** The passages anchored here, best first, each by its best-fitting anchor. */
export function nearby(passages: readonly Passage[], here: Here, limit = 6): Near[] {
  return passages
    .filter((passage) => passage.kind !== 'why')
    .flatMap((passage) => {
      const [best] = passage.anchors
        .map((anchor) => ({ anchor, score: fit(anchor, here) }))
        .filter(({ score }) => score >= LEAST_FIT)
        .sort((a, b) => b.score - a.score);
      return best === undefined ? [] : [{ passage, ...best }];
    })
    .sort((a, b) => b.score - a.score || a.passage.id.localeCompare(b.passage.id))
    .slice(0, limit);
}
