/**
 * Fossils of the moment, in deep time (PBDB): a count to tap in each cell, coloured by group,
 * `fossil:<group>:<latitude>:<longitude>` when picked. A layer on the globe's host (#379):
 * `globe.addLayer(fossilLayer)`.
 */

import type { FossilCell } from '../../data/fossils';
import { SURFACE_PRIORITY, type LayerFactory } from '../../globe/layerHost';

export const fossilLayer: LayerFactory<readonly FossilCell[] | null> = (host) => {
  const layer = document.createElement('div');
  layer.className = 'empire-labels fossil-cells';
  host.container.append(layer);
  host.pickable(layer);
  const pins = host.surfaceLabels(SURFACE_PRIORITY.fossils, layer);
  let shownKey = '';

  return {
    update(cells) {
      const key =
        cells === null
          ? 'off'
          : cells
              .map(
                (cell) =>
                  `${cell.group}:${String(cell.latitude)},${String(cell.longitude)}:${String(cell.count)}`,
              )
              .join(' ');
      if (key === shownKey) return;
      shownKey = key;
      pins.show(
        cells?.map((cell) => {
          const element = document.createElement('button');
          element.type = 'button';
          element.className = `empire-label fossil-cell is-${cell.group}`;
          element.textContent = String(cell.count);
          element.dataset['pick'] =
            `fossil:${cell.group}:${String(cell.latitude)}:${String(cell.longitude)}`;
          const size = Math.round(Math.min(40, 16 + 3 * Math.sqrt(cell.count)));
          element.style.width = `${String(size)}px`;
          element.style.height = `${String(size)}px`;
          return { element, point: cell };
        }) ?? null,
      );
      host.container.dataset['fossils'] = cells === null ? 'off' : String(cells.length);
    },
  };
};
