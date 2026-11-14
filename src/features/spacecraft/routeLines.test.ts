import { describe, expect, it } from 'vitest';

import { Scene } from 'three';

import type { LayerHost } from '../../globe/layerHost';
import { createRouteLines, missionRoutes } from './routeLines';

describe('the whole route of a mission followed (#712)', () => {
  it('Given nothing to draw, Then nothing shows', () => {
    const lines = createRouteLines();
    lines.set(null);
    expect(lines.object.visible).toBe(false);
    lines.set([]);
    expect(lines.object.visible).toBe(false);
  });

  it('Given a route, Then a segment joins each point to the next, broken where it is not placed', () => {
    const lines = createRouteLines();
    lines.set([
      {
        points: [[0, 0, 0], [1, 0, 0], null, [3, 0, 0], [4, 0, 0], [5, 0, 0]],
        approximate: false,
      },
    ]);
    expect(lines.object.visible).toBe(true);
    // 0–1, then 3–4 and 4–5: none across the gap.
    expect(lines.segments()).toBe(3);
    const position = lines.object.geometry.getAttribute('position');
    expect([position.getX(2), position.getX(3)]).toEqual([3, 4]);
    expect(lines.object.geometry.drawRange.count).toBe(6);
  });

  it('Given routes as flown and approximate, Then each is in its craft’s colour, faint', () => {
    const lines = createRouteLines();
    lines.set([
      {
        points: [
          [0, 0, 0],
          [1, 0, 0],
        ],
        approximate: false,
      },
      {
        points: [
          [0, 1, 0],
          [1, 1, 0],
        ],
        approximate: true,
      },
    ]);
    const colour = lines.object.geometry.getAttribute('color');
    expect(colour.getX(0)).toBeCloseTo(0.5);
    expect(colour.getX(2)).toBeCloseTo(1);
    expect(colour.getW(0)).toBeLessThan(1);
  });

  it('Given the layer on the globe, Then routes go into the scene where the globe puts space, counted', () => {
    const scene = new Scene();
    let toScene: LayerHost['spaceToScene'] = () => null;
    let renders = 0;
    const container = { dataset: {} as Record<string, string> };
    const layer = missionRoutes({
      scene,
      container,
      spaceToScene: () => toScene(),
      requestRender: () => {
        renders += 1;
      },
    } as unknown as LayerHost);
    const route = {
      points: [
        [1000, 0, 0],
        [2000, 0, 0],
      ] as const,
      approximate: true,
    };
    layer.update([route]);
    // No moment yet: nothing drawn.
    expect(container.dataset['routes']).toBe('0');
    toScene = () => (km) => [km[0] / 1000, km[1], km[2]];
    layer.update([route]);
    expect(container.dataset['routes']).toBe('1');
    const lines = scene.children[0];
    expect(lines?.visible).toBe(true);
    layer.update(null);
    expect(container.dataset['routes']).toBe('0');
    expect(renders).toBe(3);
  });
});
