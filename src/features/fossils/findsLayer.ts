/**
 * One genus's finds (#309), or a group of genera's, marked on the globe in deep time: a ring at
 * each site where it was found in the moment's step, over the fossil counts. A layer on the
 * globe's host (#379): `globe.addLayer(findsLayer)`.
 */

import type { LineageGroup, TrackPoint } from '../../data/lineages';
import { SURFACE_PRIORITY, type LayerFactory } from '../../globe/layerHost';

/** The sites to ring, and whose group's colour they take; null for none. */
export interface Finds {
  readonly group: LineageGroup;
  readonly sites: readonly TrackPoint[];
}

export const findsLayer: LayerFactory<Finds | null> = (host) => {
  const layer = document.createElement('div');
  layer.className = 'empire-labels fossil-finds';
  host.container.append(layer);
  const pins = host.surfaceLabels(SURFACE_PRIORITY.fossilFinds, layer);
  let shownKey = '';

  return {
    update(finds) {
      const key =
        finds === null
          ? 'off'
          : `${finds.group} ${finds.sites
              .map((site) => `${String(site.latitude)},${String(site.longitude)}`)
              .join(' ')}`;
      if (key === shownKey) return;
      shownKey = key;
      pins.show(
        finds?.sites.map((site) => {
          const element = document.createElement('span');
          element.className = `empire-label fossil-find is-${finds.group}`;
          element.title = `${String(site.finds)} ${site.finds === 1 ? 'find' : 'finds'}`;
          return { element, point: site };
        }) ?? null,
      );
      host.container.dataset['fossilFinds'] = finds === null ? 'off' : String(finds.sites.length);
    },
  };
};
