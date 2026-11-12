/**
 * Earth close up in tiles of the full-size Blue Marble (#568), drawn over the globe's own map.
 *
 * Each tile is a patch of the sphere a hair above the globe, wearing the Earth's own shader with
 * the tile as its day map: day and night, the shelf, the ice, the states and the temperature
 * all come out as on the globe beneath, only the ground sharper. Only the tiles the camera sees
 * are fetched (`tileGrid.ts`), a few at a time; each fades in once it arrives, and those not
 * seen for longest are let go past the number the device keeps (`tileLimits.ts`), textures freed.
 *
 * Of the levels in the manifest, the coarsest is drawn until its pixels would each span more than
 * `STRETCH` of the screen's: then the next (#569), so the finer tiles are fetched only close in.
 * Until a finer tile arrives, the coarser one over the same ground stays drawn if it is kept, and
 * the finer one then shows at once over it, where with nothing beneath it fades in.
 *
 * WebGL glue, covered by the Playwright suite; which tiles are seen is unit-tested.
 */

import {
  Matrix4,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  Vector4,
  type BufferGeometry,
  type PerspectiveCamera,
  type Texture,
} from 'three';

import { tilePath, type EarthTiles } from '../data/earthTiles';
import {
  levelFor,
  parentTile,
  tileId,
  tileRect,
  tilesInView,
  type TileCamera,
  type TileKey,
  type TileLevel,
} from './tileGrid';
import type { TileLimits } from './tileLimits';

const FADE_MS = 400;
/**
 * The patches' height above the globe's sphere: 64 m for level 4 and 64 m more for each finer
 * level, so a finer tile always lies over a coarser one (whose flat facets sag up to 120 m
 * between corners), and all under everything drawn over the ground (12 km and up).
 */
const LIFT = 1e-5;
/** A level is drawn until each of its pixels spans this many of the screen's. */
const STRETCH = 4;
/** Each patch's segments each way: four to each of the globe's own, so their corners meet. */
const SEGMENTS = 16;

type EarthMesh = Mesh<BufferGeometry, ShaderMaterial>;

interface Tile {
  readonly key: TileKey;
  mesh: EarthMesh | null;
  /** How opaque the tile is drawn, for its fade. */
  readonly alpha: { value: number };
  /** When the tile was first drawn; null until then. */
  shownAt: number | null;
  lastSeen: number;
}

export interface EarthTileLayer {
  /** Draw tiles from now on, from the manifest, with the tiles' files under `folder`. */
  enable(tiles: EarthTiles, folder: string): void;
  /**
   * Before each frame: show the tiles in view and fetch those missing, if `on` and close enough.
   * True while one is still fading in, so another frame is wanted.
   */
  update(camera: PerspectiveCamera, on: boolean, now: number): boolean;
}

export interface EarthTileOptions {
  readonly anisotropy: number;
  /**
   * How far out tiles are drawn, and how many are drawn, kept and fetched at once (#578); null
   * where the graphics take on none.
   */
  readonly limits: TileLimits | null;
  /** The drawing's height in device pixels. */
  readonly pixels: () => number;
  /** A tile arrived: draw a frame. */
  readonly requestRender: () => void;
  /** How many tiles are drawn, were fetched and are kept, for whoever needs to know. */
  readonly report: (shown: number, fetched: number, kept: number) => void;
}

/** A patch of the unit sphere over one tile, its texture coordinates the globe's own. */
function patchGeometry(level: TileLevel, key: TileKey): SphereGeometry {
  const [u, v, width, height] = tileRect(level, key);
  const geometry = new SphereGeometry(
    1 + LIFT * Math.max(1, level.z - 3),
    SEGMENTS,
    SEGMENTS,
    u * 2 * Math.PI,
    width * 2 * Math.PI,
    (1 - v - height) * Math.PI,
    height * Math.PI,
  );
  // three lays a part of a sphere's texture from 0 to 1 (and nudges it at a pole): lay it as
  // the whole sphere's instead, so the shader samples the other maps where the globe does.
  const uv = geometry.getAttribute('uv');
  for (let row = 0; row <= SEGMENTS; row += 1) {
    for (let column = 0; column <= SEGMENTS; column += 1) {
      uv.setXY(
        row * (SEGMENTS + 1) + column,
        u + (column / SEGMENTS) * width,
        v + height - (row / SEGMENTS) * height,
      );
    }
  }
  return geometry;
}

/** A tile's patch, in the Earth's shader with the tile for its day map. */
function patchMesh(earth: EarthMesh, level: TileLevel, tile: Tile, map: Texture): EarthMesh {
  const material = new ShaderMaterial({
    uniforms: {},
    vertexShader: earth.material.vertexShader,
    fragmentShader: earth.material.fragmentShader,
    transparent: true,
  });
  const own = {
    dayMap: { value: map },
    dayRect: { value: new Vector4(...tileRect(level, tile.key)) },
    dayAlpha: tile.alpha,
  };
  // The globe's uniforms, shared: it swaps some for new ones as it goes, so take them afresh
  // before each draw.
  const share = (): void => {
    Object.assign(material.uniforms, earth.material.uniforms, own);
  };
  share();
  const mesh = new Mesh(patchGeometry(level, tile.key), material);
  mesh.onBeforeRender = share;
  mesh.visible = false;
  return mesh;
}

function disposePatch(mesh: EarthMesh): void {
  mesh.removeFromParent();
  mesh.geometry.dispose();
  mesh.material.dispose();
  (mesh.material.uniforms['dayMap']?.value as Texture | undefined)?.dispose();
}

const toLocal = new Matrix4();
const eye = new Vector3();
const forward = new Vector3();
const up = new Vector3();

/** The camera in the globe's own frame, which turns with the moment. */
function cameraOnEarth(earth: EarthMesh, camera: PerspectiveCamera): TileCamera {
  earth.updateWorldMatrix(true, false);
  toLocal.copy(earth.matrixWorld).invert();
  eye.copy(camera.position).applyMatrix4(toLocal);
  camera.getWorldDirection(forward).transformDirection(toLocal);
  up.set(0, 1, 0).applyQuaternion(camera.quaternion).transformDirection(toLocal);
  return {
    eye: [eye.x, eye.y, eye.z],
    forward: [forward.x, forward.y, forward.z],
    up: [up.x, up.y, up.z],
    verticalFovDegrees: camera.fov,
    aspect: camera.aspect,
  };
}

interface Wanted {
  readonly level: TileLevel;
  /** The tiles of `level` in view, nearest first. */
  readonly keys: readonly TileKey[];
  /** The next coarser level, whose tiles stand in for those of `level` not yet arrived. */
  readonly coarser: TileLevel | null;
}

/** The tiles to draw, or null when the camera is too far for any or the device takes none. */
export function wantedTiles(
  tiles: EarthTiles,
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
  return {
    level,
    keys: tilesInView(level, view, limits.shown),
    coarser: index > 0 ? (tiles.levels[index - 1] ?? null) : null,
  };
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
  const parentOf = (key: TileKey): TileKey | null =>
    coarser === null ? null : parentTile(coarser, key, level);
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

/** Past `most` kept, let go those not seen for longest, other than those wanted now. */
export function trim(kept: Map<string, Tile>, wanted: ReadonlySet<string>, most: number): void {
  if (kept.size <= most) return;
  const oldest = [...kept.entries()]
    .filter(([id]) => !wanted.has(id))
    .sort(([, a], [, b]) => a.lastSeen - b.lastSeen);
  for (const [id, tile] of oldest.slice(0, kept.size - most)) {
    kept.delete(id);
    if (tile.mesh !== null) disposePatch(tile.mesh);
  }
}

/** Hide every tile kept; return those that were drawn. */
function hideAll(kept: ReadonlyMap<string, Tile>): Set<string> {
  const drawn = new Set<string>();
  for (const [id, tile] of kept) {
    if (tile.mesh === null) continue;
    if (tile.mesh.visible) drawn.add(id);
    tile.mesh.visible = false;
  }
  return drawn;
}

/** Draw a tile in view if it has arrived, fading it in unless `over` a coarser one. */
function reveal(tile: Tile, now: number, over: boolean): { shown: boolean; fading: boolean } {
  tile.lastSeen = now;
  if (tile.mesh === null) return { shown: false, fading: false };
  tile.shownAt ??= over ? now - FADE_MS : now;
  tile.alpha.value = Math.min(1, (now - tile.shownAt) / FADE_MS);
  tile.mesh.visible = true;
  return { shown: true, fading: tile.alpha.value < 1 };
}

export function createEarthTileLayer(earth: EarthMesh, options: EarthTileOptions): EarthTileLayer {
  const { limits } = options;
  const atOnce = limits?.loading ?? 0;
  let manifest: { readonly tiles: EarthTiles; readonly folder: string } | null = null;
  const kept = new Map<string, Tile>();
  let loading = 0;
  let fetched = 0;
  const loader = new TextureLoader();

  function load(folder: string, tiles: EarthTiles, tile: Tile): void {
    const { x, y, z } = tile.key;
    const level = tiles.levels.find((each) => each.z === z);
    if (level === undefined) return;
    loading += 1;
    fetched += 1;
    const settled = (): void => {
      loading -= 1;
      options.requestRender();
    };
    loader.loadAsync(`${folder}${tilePath(tiles, z, x, y)}`).then(
      (map) => {
        map.colorSpace = SRGBColorSpace;
        map.anisotropy = options.anisotropy;
        // Let go while on its way: not wanted now.
        if (kept.get(tileId(tile.key)) === tile) {
          tile.mesh = patchMesh(earth, level, tile, map);
          earth.add(tile.mesh);
        } else map.dispose();
        settled();
      },
      // Its mesh stays null: not asked again until it is let go and seen anew.
      settled,
    );
  }

  /**
   * Show a tile in view, fetching it if it is not kept (and `fetch`); whether it is drawn, and
   * still fading in. Over a coarser tile already drawn (`over`), it shows at once.
   */
  function show(
    key: TileKey,
    now: number,
    fetch: boolean,
    over = false,
  ): { shown: boolean; fading: boolean } {
    const id = tileId(key);
    let tile = kept.get(id);
    if (tile === undefined && fetch && manifest !== null && loading < atOnce) {
      tile = { key, mesh: null, alpha: { value: 0 }, shownAt: null, lastSeen: now };
      kept.set(id, tile);
      load(manifest.folder, manifest.tiles, tile);
    }
    return tile === undefined ? { shown: false, fading: false } : reveal(tile, now, over);
  }

  return {
    enable(tiles, folder) {
      manifest ??= { tiles, folder };
      options.requestRender();
    },
    update(camera, on, now) {
      const drawnBefore = hideAll(kept);
      const wanted =
        on && manifest !== null
          ? wantedTiles(manifest.tiles, cameraOnEarth(earth, camera), options.pixels(), limits)
          : null;
      const plan = drawPlan(
        wanted,
        (key) => (kept.get(tileId(key))?.mesh ?? null) !== null,
        drawnBefore,
      );
      let shown = 0;
      let fading = false;
      for (const parent of plan.beneath) if (show(parent, now, false).shown) shown += 1;
      for (const { key, over } of plan.tiles) {
        const seen = show(key, now, true, over);
        if (seen.shown) shown += 1;
        fading ||= seen.fading;
      }
      const ids = new Set([...plan.beneath, ...plan.tiles.map(({ key }) => key)].map(tileId));
      if (wanted !== null) trim(kept, ids, limits?.kept ?? 0);
      options.report(shown, fetched, kept.size);
      return fading;
    },
  };
}
