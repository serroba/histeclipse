/**
 * Today's heights in tiles over the ice-age globe close up (#1016): the Blue Marble's tile layer
 * (#568), its tiles read as data. Their patches tell the Earth shader they carry heights
 * (`reliefTile`), and how to read them, from the manifest (`reliefShader.ts`).
 */

import { type BufferGeometry, type Mesh, type ShaderMaterial, Vector2 } from 'three';

import type { ReliefTiles } from '../data/reliefTiles';
import { createEarthTileLayer, type EarthTileLayer, type EarthTileOptions } from './earthTiles';

export interface ReliefTileLayer {
  /** Draw tiles from now on, read as the manifest says, with their files under `folder`. */
  readonly enable: (tiles: ReliefTiles, folder: string) => void;
  readonly update: (...args: Parameters<EarthTileLayer['update']>) => boolean;
}

export function createReliefTileLayer(
  earth: Mesh<BufferGeometry, ShaderMaterial>,
  options: Omit<EarthTileOptions, 'anisotropy' | 'data'>,
): ReliefTileLayer {
  const reliefCells = { value: new Vector2() };
  const reliefOffset = { value: 0 };
  const layer = createEarthTileLayer(earth, {
    ...options,
    anisotropy: 1,
    data: { reliefTile: { value: 1 }, reliefCells, reliefOffset },
  });
  return {
    enable: (tiles, folder) => {
      reliefCells.value.set(tiles.tileSize, tiles.border);
      reliefOffset.value = tiles.offset;
      layer.enable(tiles, folder);
    },
    update: (camera, on, now) => layer.update(camera, on, now),
  };
}
