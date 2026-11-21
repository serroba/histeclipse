/**
 * Which of a tile pyramid's tiles to draw this frame (#568, #569): the level for the camera's
 * height and the screen's sharpness, the tiles of it in view, and the coarser ones to keep
 * beneath those still on their way. Pure: the drawing is in `earthTiles.ts`.
 */

import {
  levelFor,
  parentTile,
  tileId,
  tilesInView,
  type TileCamera,
  type TileKey,
  type TileLevel,
} from './tileGrid';
import type { TileLimits } from './tileLimits';

/** A level is drawn until each of its pixels spans this many of the screen's. */
const STRETCH = 4;
/**
 * A pyramid of tiles: the Blue Marble's (#568), or today's heights (#1016). A level may leave
 * some tiles out (`missing`, as `x/y`): the next coarser level's tile is drawn there (#1030).
 */
export interface TilePyramid {
  readonly tileSize: number;
  readonly path: string;
  readonly levels: readonly (TileLevel & { readonly missing?: readonly string[] | undefined })[];
}

export interface Wanted {
  readonly level: TileLevel;
  /** The tiles of `level` in view, nearest first; where `level` has none, `coarser`'s. */
  readonly keys: readonly TileKey[];
  /** The next coarser level, whose tiles stand in for those of `level` not yet arrived. */
  readonly coarser: TileLevel | null;
}

/** The tiles to draw, or null when the camera is too far for any or the device takes none. */
export function wantedTiles(
  tiles: TilePyramid,
  view: TileCamera,
  pixels: number,
  limits: TileLimits | null,
): Wanted | null {
  const distance = Math.hypot(...view.eye);
  if (limits === null || distance > limits.within) return null;
  const pixelAngle = (view.verticalFovDegrees * Math.PI) / 180 / Math.max(pixels, 1);
  const level = levelFor(tiles.levels, tiles.tileSize, distance - 1, pixelAngle, STRETCH);
  if (level === null) return null;
  const index = tiles.levels.indexOf(level);
  const coarser = index > 0 ? (tiles.levels[index - 1] ?? null) : null;
  const missing = new Set(level.missing);
  const keys = new Map<string, TileKey>();
  for (const key of tilesInView(level, view, limits.shown)) {
    const shown = missing.has(`${String(key.x)}/${String(key.y)}`)
      ? coarser && parentTile(coarser, key, level)
      : key;
    if (shown) keys.set(tileId(shown), shown);
  }
  return { level, keys: [...keys.values()], coarser };
}

interface DrawPlan {
  /** The coarser tiles to draw beneath those not yet arrived: kept ones only, never fetched. */
  readonly beneath: readonly TileKey[];
  /** The tiles wanted, each with whether a coarser one is (or was last frame) drawn beneath. */
  readonly tiles: readonly { readonly key: TileKey; readonly over: boolean }[];
}

/**
 * What to draw this frame of what is `wanted`, given which tiles are `ready` (arrived) and which
 * were drawn the frame before: so no ground goes back to the globe's map while a finer tile is
 * on its way, and a finer tile replaces the coarser one at once rather than fading in.
 */
export function drawPlan(
  wanted: Wanted | null,
  ready: (key: TileKey) => boolean,
  drawnBefore: ReadonlySet<string>,
): DrawPlan {
  if (wanted === null) return { beneath: [], tiles: [] };
  const { level, coarser, keys } = wanted;
  // A coarser tile standing in for a missing one has none beneath it.
  const parentOf = (key: TileKey): TileKey | null =>
    coarser === null || key.z !== level.z ? null : parentTile(coarser, key, level);
  const beneath = new Map<string, TileKey>();
  for (const key of keys) {
    const parent = parentOf(key);
    if (parent !== null && !ready(key) && ready(parent)) beneath.set(tileId(parent), parent);
  }
  const tiles = keys.map((key) => {
    const parent = parentOf(key);
    const id = parent === null ? null : tileId(parent);
    return { key, over: id !== null && (beneath.has(id) || drawnBefore.has(id)) };
  });
  return { beneath: [...beneath.values()], tiles };
}
