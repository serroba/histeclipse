/**
 * Where the AMOC is measured (#925): the RAPID array's line across the Atlantic at 26.5°N, from
 * Florida to the coast of Africa, painted on the history map while the layer is on.
 */

import { HISTORY_PAINT_ORDER, type LayerFactory } from '../../globe/layerHost';

/** The array's ends: the Florida Strait to the African shelf, degrees. */
const RAPID_LINE = { latitude: 26.5, west: -80.1, east: -13.5 } as const;

/** The line's ends on a map `width` by `height` (90°N at the top, 180°W at the left). */
export function lineOnMap(
  width: number,
  height: number,
): { readonly x1: number; readonly x2: number; readonly y: number } {
  const x = (longitude: number): number => ((longitude + 180) / 360) * width;
  return {
    x1: x(RAPID_LINE.west),
    x2: x(RAPID_LINE.east),
    y: ((90 - RAPID_LINE.latitude) / 180) * height,
  };
}

export const rapidLine: LayerFactory<boolean> = (host) => {
  const slot = host.historyPaint(HISTORY_PAINT_ORDER.amoc);
  let shown = false;
  return {
    update(on) {
      host.container.dataset['amocLine'] = on ? 'on' : 'off';
      if (on === shown) return;
      shown = on;
      slot.show(
        on
          ? (canvas) => {
              const context = canvas.getContext('2d');
              if (context === null) return;
              const { x1, x2, y } = lineOnMap(canvas.width, canvas.height);
              context.strokeStyle = 'rgb(255 214 102)';
              context.lineWidth = Math.max(2, canvas.height / 300);
              context.setLineDash([canvas.width / 400, canvas.width / 600]);
              context.beginPath();
              context.moveTo(x1, y);
              context.lineTo(x2, y);
              context.stroke();
              context.setLineDash([]);
            }
          : null,
      );
    },
  };
};
