// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import type { RouteShown } from '../../data/humanRoutes';
import type { LayerHost, SurfacePin } from '../../globe/layerHost';
import { paintRoutes, routeLayer } from './routeLayer';

const route = (id: string, dashed: boolean): RouteShown => ({
  id,
  label: `${id}?`,
  citation: 'A 2020',
  weighed: { for: 3, against: 1 },
  path: [
    [10, 0],
    [20, 5],
    [30, 0],
  ],
  middle: { latitude: 5, longitude: 20 },
  colour: 1,
  dashed,
});

/** A 2D context that records the strokes, dashes and fills asked of it. */
function recording() {
  const calls: string[] = [];
  const context = new Proxy(
    {},
    {
      get:
        (_, name: string) =>
        (...args: unknown[]) => {
          calls.push(name === 'setLineDash' ? `dash ${JSON.stringify(args[0])}` : name);
        },
      set: () => true,
    },
  );
  const canvas = Object.assign(document.createElement('canvas'), { width: 900, height: 450 });
  vi.spyOn(canvas, 'getContext').mockReturnValue(context as CanvasRenderingContext2D);
  return { canvas, calls };
}

describe('the routes painted on the deep-time map', () => {
  it('Given a route and a rival, Then each is a curve with an arrowhead, the rival dashed, on each copy of the map', () => {
    const { canvas, calls } = recording();
    paintRoutes(canvas, [route('a', false), route('b', true)]);
    // Three copies of the map (either side of the date line), each a line and a head.
    expect(calls.filter((call) => call === 'stroke')).toHaveLength(6);
    expect(calls.filter((call) => call === 'fill')).toHaveLength(6);
    expect(calls).toContain('quadraticCurveTo');
    expect(calls).toContain('dash [6,4]');
  });

  it('Given no 2D context, Then nothing is painted', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue(null);
    expect(() => {
      paintRoutes(canvas, [route('a', false)]);
    }).not.toThrow();
  });

  it('Given routes, Then they are painted once and named at their middles, to tap; null takes them away', () => {
    const painted: unknown[] = [];
    const named: (readonly SurfacePin[] | null)[] = [];
    const container = document.createElement('div');
    const layer = routeLayer({
      container,
      deepPaint: () => ({ show: (painter: unknown) => painted.push(painter) }),
      pickable: () => undefined,
      surfaceLabels: () => ({ show: (pins: readonly SurfacePin[] | null) => named.push(pins) }),
    } as unknown as LayerHost);
    layer.update([route('a', false), route('b', true)]);
    layer.update([route('a', false), route('b', true)]);
    expect(painted).toHaveLength(1);
    expect(container.dataset['humanRoutes']).toBe('a b');
    const pins = named[0] ?? [];
    expect(pins.map((pin) => pin.element.dataset['pick'])).toEqual([
      'human:route-a',
      'human:route-b',
    ]);
    expect(pins[1]?.element.className).toBe('empire-label human-route is-route-1 is-dashed');
    const { canvas } = recording();
    (painted[0] as (canvas: HTMLCanvasElement) => void)(canvas);
    layer.update([]);
    expect(painted.at(-1)).toBeNull();
    expect(container.dataset['humanRoutes']).toBe('none');
    layer.update(null);
    expect(container.dataset['humanRoutes']).toBe('off');
    // A first look with no routes says so too.
    const fresh = document.createElement('div');
    routeLayer({
      container: fresh,
      deepPaint: () => ({ show: () => undefined }),
      pickable: () => undefined,
      surfaceLabels: () => ({ show: () => undefined }),
    } as unknown as LayerHost).update([]);
    expect(fresh.dataset['humanRoutes']).toBe('none');
    expect(named.at(-1)).toBeNull();
  });
});
