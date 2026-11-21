/**
 * Routes people are argued to have taken (#177), in deep time: each painted on the deep-time map
 * as a soft curve with an arrowhead at its end, rivals in one colour (the second dashed), and a
 * name at its middle to tap, `human:route-<id>`. A layer on the globe's host (#379).
 */

import { copiesOf } from '../../data/empires';
import type { RouteShown } from '../../data/humanRoutes';
import { DEEP_PAINT_ORDER, SURFACE_PRIORITY, type LayerFactory } from '../../globe/layerHost';
import './humanSites.css';

/** One colour per question, light enough over land, sea and ice. */
const COLOURS = [
  'rgba(255, 236, 170, 0.95)',
  'rgba(150, 230, 255, 0.95)',
  'rgba(200, 255, 190, 0.95)',
  'rgba(255, 190, 235, 0.95)',
] as const;

const routeColour = (colour: number): string => COLOURS[colour % COLOURS.length] ?? COLOURS[0];

/** A curve through a way's points (each segment bent through the next midpoint), and its arrowhead. */
export function paintRoutes(canvas: HTMLCanvasElement, routes: readonly RouteShown[]): void {
  const context = canvas.getContext('2d');
  if (context === null) return;
  const { width, height } = canvas;
  const xy = ([lon, lat]: readonly [number, number], offset: number): [number, number] => [
    ((lon + offset + 180) / 360) * width,
    ((90 - lat) / 180) * height,
  ];
  const line = Math.max(2, width / 900);
  context.lineJoin = 'round';
  context.lineCap = 'round';
  for (const route of routes) {
    context.strokeStyle = routeColour(route.colour);
    context.fillStyle = routeColour(route.colour);
    context.lineWidth = line;
    // Only where the route shows on the map: most once, one across the date line twice (#1045).
    for (const offset of copiesOf(route.path)) {
      const points = route.path.map((point) => xy(point, offset));
      const [first, ...rest] = points;
      if (first === undefined) continue;
      context.setLineDash(route.dashed ? [line * 3, line * 2] : []);
      context.beginPath();
      context.moveTo(...first);
      rest.forEach((point, i) => {
        const next = rest[i + 1];
        if (next === undefined) context.lineTo(...point);
        else context.quadraticCurveTo(...point, (point[0] + next[0]) / 2, (point[1] + next[1]) / 2);
      });
      context.stroke();
      // The arrowhead, along the last step.
      const tip = points.at(-1);
      const back = points.at(-2);
      if (tip === undefined || back === undefined) continue;
      const angle = Math.atan2(tip[1] - back[1], tip[0] - back[0]);
      const size = line * 4;
      context.setLineDash([]);
      context.beginPath();
      context.moveTo(...tip);
      context.lineTo(
        tip[0] - size * Math.cos(angle - 0.45),
        tip[1] - size * Math.sin(angle - 0.45),
      );
      context.lineTo(
        tip[0] - size * Math.cos(angle + 0.45),
        tip[1] - size * Math.sin(angle + 0.45),
      );
      context.closePath();
      context.fill();
    }
  }
  context.setLineDash([]);
}

/** The routes argued for at the moment shown; null hides them. */
export const routeLayer: LayerFactory<readonly RouteShown[] | null> = (host) => {
  const slot = host.deepPaint(DEEP_PAINT_ORDER.routes);
  const layer = document.createElement('div');
  layer.className = 'empire-labels human-routes';
  host.container.append(layer);
  host.pickable(layer);
  const names = host.surfaceLabels(SURFACE_PRIORITY.humanRoutes, layer);
  let shownKey = '';

  return {
    update(routes) {
      // Painting the map is slow: not again for the same routes, as time plays on.
      const key = routes === null ? 'off' : routes.map((route) => route.id).join(' ') || 'none';
      if (key === shownKey) return;
      shownKey = key;
      host.container.dataset['humanRoutes'] = key;
      slot.show(
        routes === null || routes.length === 0
          ? null
          : (canvas) => {
              paintRoutes(canvas, routes);
            },
      );
      names.show(
        routes?.map((route) => {
          const element = document.createElement('button');
          element.type = 'button';
          element.className = `empire-label human-route is-route-${String(route.colour % COLOURS.length)}${route.dashed ? ' is-dashed' : ''}`;
          element.textContent = route.label;
          element.dataset['route'] = route.id;
          element.dataset['pick'] = `human:route-${route.id}`;
          return { element, point: route.middle };
        }) ?? null,
      );
    },
  };
};
