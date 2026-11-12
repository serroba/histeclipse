/**
 * Which of Earth's tiles the camera sees (#568): pure geometry, no drawing.
 *
 * The tiles are a pyramid in simple cylindrical projection, addressed z/x/y as web maps are:
 * level z is `columns` (2^(z+1)) tiles across and `rows` (2^z) down, x counted east from 180° W
 * and y south from the north pole. Points are in the globe's frame (`geo.ts`), Earth's radius 1.
 *
 * The view is sampled by rays through a grid across the screen: each that meets the sphere names
 * the tile it lands on. Tiles behind the horizon or outside the view are never hit, so they are
 * never fetched. A sliver of a tile narrower than the grid's step can be missed; it shows the
 * base map until the camera moves.
 */

import { vectorToGeo, type Vector3Tuple } from './geo';

export interface TileLevel {
  readonly z: number;
  readonly columns: number;
  readonly rows: number;
}

export interface TileKey {
  readonly z: number;
  readonly x: number;
  readonly y: number;
}

/** A camera in the globe's frame: where it is, where it looks, which way is up on screen. */
export interface TileCamera {
  readonly eye: Vector3Tuple;
  readonly forward: Vector3Tuple;
  readonly up: Vector3Tuple;
  /** The field of view from the bottom of the screen to the top, degrees. */
  readonly verticalFovDegrees: number;
  /** Width over height. */
  readonly aspect: number;
}

/** Rays across the screen, this many steps each way (one more ray than steps). */
const RAY_STEPS = 16;

/** The tile's address as a path, `z/x/y`. */
export function tileId({ z, x, y }: TileKey): string {
  return `${String(z)}/${String(x)}/${String(y)}`;
}

/** The tile of `level` that a point on (or a direction from the centre to) Earth falls in. */
export function tileAt(level: TileLevel, point: Vector3Tuple): TileKey {
  const { latitude, longitude } = vectorToGeo(point);
  const x = Math.floor(((longitude + 180) / 360) * level.columns);
  const y = Math.floor(((90 - latitude) / 180) * level.rows);
  return {
    z: level.z,
    x: Math.min(Math.max(x, 0), level.columns - 1),
    y: Math.min(Math.max(y, 0), level.rows - 1),
  };
}

/**
 * Where a tile lies on the globe's map, in its texture coordinates: left, bottom, width and
 * height, u growing east from 180° W and v north from the south pole.
 */
export function tileRect(
  level: TileLevel,
  { x, y }: Pick<TileKey, 'x' | 'y'>,
): readonly [u: number, v: number, width: number, height: number] {
  return [x / level.columns, 1 - (y + 1) / level.rows, 1 / level.columns, 1 / level.rows];
}

type Vector = readonly [number, number, number];

const dot = (a: Vector, b: Vector): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vector, b: Vector): Vector => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (v: Vector): Vector => {
  const length = Math.hypot(...v);
  return [v[0] / length, v[1] / length, v[2] / length];
};

/** Where a ray from `eye` along the unit `direction` first meets the unit sphere, if it does. */
export function hitSphere(eye: Vector3Tuple, direction: Vector3Tuple): Vector3Tuple | null {
  const b = dot(eye, direction);
  const c = dot(eye, eye) - 1;
  const discriminant = b * b - c;
  if (discriminant < 0) return null;
  const distance = -b - Math.sqrt(discriminant);
  if (distance < 0) return null;
  return [
    eye[0] + distance * direction[0],
    eye[1] + distance * direction[1],
    eye[2] + distance * direction[2],
  ];
}

/** Unit rays from the camera through a grid of `steps` by `steps` cells across the screen. */
export function viewRays(camera: TileCamera, steps = RAY_STEPS): Vector3Tuple[] {
  const forward = unit(camera.forward);
  const right = unit(cross(forward, camera.up));
  const up = cross(right, forward);
  const halfHeight = Math.tan((camera.verticalFovDegrees * Math.PI) / 360);
  const halfWidth = halfHeight * camera.aspect;
  const rays: Vector3Tuple[] = [];
  for (let i = 0; i <= steps; i += 1) {
    for (let j = 0; j <= steps; j += 1) {
      const across = ((2 * i) / steps - 1) * halfWidth;
      const down = ((2 * j) / steps - 1) * halfHeight;
      rays.push(
        unit([
          forward[0] + across * right[0] + down * up[0],
          forward[1] + across * right[1] + down * up[1],
          forward[2] + across * right[2] + down * up[2],
        ]),
      );
    }
  }
  return rays;
}

/**
 * The tiles of `level` the camera sees, nearest first (by the closest point of each seen), at
 * most `limit` of them.
 */
export function tilesInView(level: TileLevel, camera: TileCamera, limit: number): TileKey[] {
  const nearest = new Map<string, { readonly key: TileKey; distance: number }>();
  for (const ray of viewRays(camera)) {
    const hit = hitSphere(camera.eye, ray);
    if (hit === null) continue;
    const key = tileAt(level, hit);
    const distance = Math.hypot(
      hit[0] - camera.eye[0],
      hit[1] - camera.eye[1],
      hit[2] - camera.eye[2],
    );
    const seen = nearest.get(tileId(key));
    if (seen === undefined) nearest.set(tileId(key), { key, distance });
    else seen.distance = Math.min(seen.distance, distance);
  }
  return [...nearest.values()]
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map(({ key }) => key);
}

/**
 * The level to draw for a camera `altitude` above the ground (Earth radii), with screen pixels
 * `pixelAngle` radians apart: the coarsest whose pixels, on the ground, span no more than
 * `stretch` of the screen's straight below, else the finest there is. Levels come finest last.
 * A `stretch` above 1 keeps a coarser level, a little soft, until a finer one is worth fetching.
 */
export function levelFor<Level extends TileLevel>(
  levels: readonly Level[],
  tileSize: number,
  altitude: number,
  pixelAngle: number,
  stretch = 1,
): Level | null {
  const onGround = altitude * pixelAngle * stretch;
  const fine = levels.find((level) => Math.PI / (level.rows * tileSize) <= onGround);
  return fine ?? levels.at(-1) ?? null;
}

/** The tile of the coarser `level` that holds `key`, a tile of a finer one. */
export function parentTile(level: TileLevel, key: TileKey, of: TileLevel): TileKey {
  return {
    z: level.z,
    x: Math.floor((key.x * level.columns) / of.columns),
    y: Math.floor((key.y * level.rows) / of.rows),
  };
}
