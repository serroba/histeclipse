/**
 * How much of Earth's tiles (#568) a device takes on: whether any, from how far, and how many at
 * once (#578). Decided once, from what the graphics can hold and whether the screen is a phone's.
 *
 * Tiles need graphics that hold a 4096-pixel texture, as the globe's own map does; nearly every
 * phone does. A phone gets them too, within a smaller budget: fewer kept (each ~2.4 MB on the
 * GPU, mipmaps and all), fewer fetched at once on a slower link, and only from nearer in, where
 * its tall screen sees fewer of them. Graphics that cannot hold the 4096 map get no tiles, and
 * the camera stops where the globe's own map still looks sharp (`nearestDistance`).
 */

/** What a device takes on of Earth's tiles. */
export interface TileLimits {
  /** Within this many Earth radii of the centre, tiles are drawn. */
  readonly within: number;
  /** Tiles drawn at once, at most: the nearest of those in view. */
  readonly shown: number;
  /** Tiles kept with their textures, at most; those not seen for longest go first. */
  readonly kept: number;
  /** Tiles fetched at once, at most. */
  readonly loading: number;
}

/** The smallest texture, in pixels, the graphics must hold for tiles. */
export const TILES_NEED_TEXTURE = 4096;

/** A computer's: from 1.5 radii (about 3,200 km up), 32 drawn and 48 kept, 6 fetched at once. */
export const DESKTOP_TILES: TileLimits = { within: 1.5, shown: 32, kept: 48, loading: 6 };

/**
 * A phone's: from 1.3 radii (about 1,900 km up), where a phone's tall view holds some 7 to 11 of
 * the full Blue Marble's tiles (twice that from 1.5), 12 drawn and 16 kept, 3 fetched at once.
 */
export const PHONE_TILES: TileLimits = { within: 1.3, shown: 12, kept: 16, loading: 3 };

/**
 * The tile limits of a device whose graphics hold textures up to `maxTextureSize` pixels wide,
 * held by a finger (`coarsePointer`: a phone or tablet) or not; null when it takes on no tiles.
 */
export function tileLimits(maxTextureSize: number, coarsePointer: boolean): TileLimits | null {
  if (maxTextureSize < TILES_NEED_TEXTURE) return null;
  return coarsePointer ? PHONE_TILES : DESKTOP_TILES;
}
