/**
 * Earth close up in tiles of the full-size Blue Marble (#568), drawn over the globe's own map.
 *
 * Each tile is a patch of the sphere a hair above the globe, wearing the Earth's own shader with
 * the tile as its day map: day and night, the shelf, the ice, the states and the temperature
 * all come out as on the globe beneath, only the ground sharper. Only the tiles the camera sees
 * are fetched (`tileGrid.ts`), a few at a time; each fades in once it arrives, and those not
 * seen for longest are let go past a fixed number, their textures freed.
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
  tileId,
  tileRect,
  tilesInView,
  type TileCamera,
  type TileKey,
  type TileLevel,
} from './tileGrid';

/** Within this many Earth radii of the centre (about 3,200 km up), tiles are drawn. */
const TILES_WITHIN = 1.5;
/** Tiles drawn at once, at most, and kept with their textures, at most (~2.4 MB each). */
const MAX_SHOWN = 32;
const MAX_KEPT = 48;
/** Tiles fetched at once, at most. */
const MAX_LOADING = 6;
const FADE_MS = 400;
/** The patches' height above the globe's sphere: 64 m, under everything drawn over the ground. */
const LIFT = 1e-5;
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
  /** The drawing's height in device pixels. */
  readonly pixels: () => number;
  /** A tile arrived: draw a frame. */
  readonly requestRender: () => void;
  /** How many tiles are drawn and how many were fetched, for whoever needs to know. */
  readonly report: (shown: number, fetched: number) => void;
}

/** A patch of the unit sphere over one tile, its texture coordinates the globe's own. */
function patchGeometry(level: TileLevel, key: TileKey): SphereGeometry {
  const [u, v, width, height] = tileRect(level, key);
  const geometry = new SphereGeometry(
    1 + LIFT,
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

/** The tiles to draw, nearest first, or null when the camera is too far for any. */
function wantedTiles(
  tiles: EarthTiles,
  view: TileCamera,
  pixels: number,
): readonly TileKey[] | null {
  const distance = Math.hypot(...view.eye);
  if (distance > TILES_WITHIN) return null;
  const pixelAngle = (view.verticalFovDegrees * Math.PI) / 180 / Math.max(pixels, 1);
  const level = levelFor(tiles.levels, tiles.tileSize, distance - 1, pixelAngle);
  return level === null ? null : tilesInView(level, view, MAX_SHOWN);
}

export function createEarthTileLayer(earth: EarthMesh, options: EarthTileOptions): EarthTileLayer {
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

  /** Past MAX_KEPT, let go those not seen for longest, other than those wanted now. */
  function trim(wanted: ReadonlySet<string>): void {
    if (kept.size <= MAX_KEPT) return;
    const oldest = [...kept.entries()]
      .filter(([id]) => !wanted.has(id))
      .sort(([, a], [, b]) => a.lastSeen - b.lastSeen);
    for (const [id, tile] of oldest.slice(0, kept.size - MAX_KEPT)) {
      kept.delete(id);
      if (tile.mesh !== null) disposePatch(tile.mesh);
    }
  }

  /** Show a tile in view, fetching it if it is not kept; whether it is still fading in. */
  function show(key: TileKey, now: number): { shown: boolean; fading: boolean } {
    const id = tileId(key);
    let tile = kept.get(id);
    if (tile === undefined && manifest !== null && loading < MAX_LOADING) {
      tile = { key, mesh: null, alpha: { value: 0 }, shownAt: null, lastSeen: now };
      kept.set(id, tile);
      load(manifest.folder, manifest.tiles, tile);
    }
    if (tile === undefined) return { shown: false, fading: false };
    tile.lastSeen = now;
    if (tile.mesh === null) return { shown: false, fading: false };
    tile.shownAt ??= now;
    tile.alpha.value = Math.min(1, (now - tile.shownAt) / FADE_MS);
    tile.mesh.visible = true;
    return { shown: true, fading: tile.alpha.value < 1 };
  }

  return {
    enable(tiles, folder) {
      manifest ??= { tiles, folder };
      options.requestRender();
    },
    update(camera, on, now) {
      for (const tile of kept.values()) if (tile.mesh !== null) tile.mesh.visible = false;
      const keys =
        on && manifest !== null
          ? wantedTiles(manifest.tiles, cameraOnEarth(earth, camera), options.pixels())
          : null;
      let shown = 0;
      let fading = false;
      for (const key of keys ?? []) {
        const seen = show(key, now);
        if (seen.shown) shown += 1;
        fading ||= seen.fading;
      }
      if (keys !== null) trim(new Set(keys.map(tileId)));
      options.report(shown, fetched);
      return fading;
    },
  };
}
