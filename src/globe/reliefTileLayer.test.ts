import { Mesh, PerspectiveCamera, ShaderMaterial, SphereGeometry } from 'three';
import { describe, expect, it, vi } from 'vitest';

import type { ReliefTiles } from '../data/reliefTiles';
import { createReliefTileLayer } from './reliefTileLayer';
import { DESKTOP_TILES } from './tileLimits';

const manifest: ReliefTiles = {
  schemaVersion: 1,
  credit: 'ETOPO 2022',
  source: 'https://doi.org/10.25921/fd45-gt74',
  tileSize: 675,
  border: 2,
  path: '{z}/{x}/{y}.webp',
  offset: 11000,
  water: { ocean: 255, lake: 128, land: 0 },
  levels: [{ z: 2, columns: 8, rows: 4 }],
  sources: [{ url: 'https://example.org/etopo.nc', sha256: 'a'.repeat(64) }],
};

function camera(distance: number): PerspectiveCamera {
  const looking = new PerspectiveCamera(40, 1, 0.01, 100);
  looking.position.set(distance, 0, 0);
  looking.lookAt(0, 0, 0);
  looking.updateMatrixWorld();
  return looking;
}

describe('the relief tile layer (#1016)', () => {
  it('draws nothing until it has its manifest, nor when off, nor from afar', () => {
    const earth = new Mesh(new SphereGeometry(1), new ShaderMaterial());
    const report = vi.fn();
    const layer = createReliefTileLayer(earth, {
      limits: DESKTOP_TILES,
      pixels: () => 800,
      requestRender: vi.fn(),
      report,
    });
    expect(layer.update(camera(1.2), true, 0)).toBe(false);
    layer.enable(manifest, '/textures/relief-tiles/');
    expect(layer.update(camera(1.2), false, 0)).toBe(false);
    expect(layer.update(camera(3), true, 0)).toBe(false);
    expect(report).toHaveBeenLastCalledWith(0, 0, 0);
  });
});
