// @vitest-environment happy-dom
import type { Mesh } from 'three';
import { describe, expect, it, vi } from 'vitest';

import type { ShellField } from '../../data/ozoneShell';
import type { LayerHost } from '../../globe/layerHost';
import { imagePixels } from './ozoneSeasons';
import { ozoneShellLayer } from './ozoneShellLayer';

function field(): ShellField {
  const cells = 5 * 8;
  return {
    rows: 5,
    columns: 8,
    lowerKm: new Float32Array(cells).fill(20),
    upperKm: new Float32Array(cells).fill(26),
    du: new Float32Array(cells).fill(310),
  };
}

describe('the ozone surface on the globe (#804)', () => {
  it('Given a day’s field, Then its mesh is put on the Earth, to turn with it, made once for the same field, and null takes it away', () => {
    const added: Mesh[] = [];
    const requestRender = vi.fn();
    const container = document.createElement('div');
    const layer = ozoneShellLayer({
      container,
      onEarth: { add: (mesh: Mesh) => added.push(mesh) },
      requestRender,
    } as unknown as LayerHost);
    const [mesh] = added;
    expect(mesh?.name).toBe('ozone-shell');
    expect(mesh?.visible).toBe(false);

    const day = field();
    layer.update(day);
    expect(mesh?.visible).toBe(true);
    expect(container.dataset['ozoneShell']).toBe('on');
    const { geometry } = mesh ?? {};
    const triangles = Number(container.dataset['ozoneShellTriangles']);
    expect(triangles).toBeGreaterThan(1000);
    expect(geometry?.drawRange.count).toBe(triangles * 3);
    expect(geometry?.getAttribute('position').count).toBe(13 * 25 * 2);
    expect(geometry?.getAttribute('color').count).toBe(13 * 25 * 2);

    // The same field again: nothing made, nothing asked of the globe.
    const position = geometry?.getAttribute('position');
    layer.update(day);
    expect(geometry?.getAttribute('position')).toBe(position);
    expect(requestRender).toHaveBeenCalledOnce();

    // Another day: the same buffers, sent again, and no normals to work out.
    layer.update(field());
    expect(geometry?.getAttribute('position')).toBe(position);
    expect(geometry?.getAttribute('normal')).toBeUndefined();
    layer.update(null);
    expect(mesh?.visible).toBe(false);
    expect(container.dataset['ozoneShell']).toBe('off');
    expect(requestRender).toHaveBeenCalledTimes(3);
  });
});

describe('a season’s image as pixels', () => {
  it('Given an image, Then it is drawn at its own size and its pixels read; with no way to draw, none', () => {
    const data = new Uint8ClampedArray([1, 2, 3, 255]);
    const drawn = vi.fn();
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: drawn,
      getImageData: (x: number, y: number, width: number, height: number) => {
        expect([x, y, width, height]).toEqual([0, 0, 120, 11224]);
        return { data };
      },
    } as unknown as CanvasRenderingContext2D);
    const image = { naturalWidth: 120, naturalHeight: 11224 } as HTMLImageElement;
    expect(imagePixels(image)).toBe(data);
    expect(drawn).toHaveBeenCalledWith(image, 0, 0);
    getContext.mockReturnValue(null);
    expect(imagePixels(image)).toBeNull();
    getContext.mockRestore();
  });
});
