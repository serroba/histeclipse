/**
 * Regions with ancient genomes near the year shown (AADR), in historical time: a count to tap in
 * each, `genome:<cell>` when picked. A layer on the globe's host (#379):
 * `globe.addLayer(genomeLayer)`.
 */

import type { GenomeCell } from '../../data/ancientGenomes';
import { SURFACE_PRIORITY, type LayerFactory } from '../../globe/layerHost';

/** Regions with this many genomes or fewer are a small dot, without a number. */
const FEW_GENOMES = 2;

export const genomeLayer: LayerFactory<readonly GenomeCell[] | null> = (host) => {
  const layer = document.createElement('div');
  layer.className = 'empire-labels genome-cells';
  host.container.append(layer);
  host.pickable(layer);
  const pins = host.surfaceLabels(SURFACE_PRIORITY.genomes, layer);
  let shownKey = '';

  return {
    update(cells) {
      const key =
        cells === null
          ? 'off'
          : cells
              .map(
                (cell) =>
                  `${String(cell.latitude)},${String(cell.longitude)}:${String(cell.count)}`,
              )
              .join(' ');
      if (key === shownKey) return;
      shownKey = key;
      pins.show(
        cells?.map((cell) => {
          const element = document.createElement('button');
          element.type = 'button';
          // One or two genomes make a small dot, without a number: many of them together
          // crowded out the states' names (#163). The count is still in its label.
          const few = cell.count <= FEW_GENOMES;
          element.className = `empire-label genome-cell${few ? ' is-few' : ''}`;
          if (!few) element.textContent = String(cell.count);
          element.setAttribute(
            'aria-label',
            `${String(cell.count)} ${cell.count === 1 ? 'genome' : 'genomes'}: details`,
          );
          element.dataset['pick'] = `genome:${String(cell.cell)}`;
          // Bigger for more genomes, gently: a square root, from 18 to 44 pixels.
          const size = few ? 10 : Math.round(Math.min(44, 18 + 4 * Math.sqrt(cell.count)));
          element.style.width = `${String(size)}px`;
          element.style.height = `${String(size)}px`;
          element.title = `${String(cell.count)} genomes; lab labels: ${cell.labels.map(([label, count]) => `${label} ×${String(count)}`).join(', ')}`;
          return { element, point: cell };
        }) ?? null,
      );
      host.container.dataset['genomes'] = cells === null ? 'off' : String(cells.length);
    },
  };
};
