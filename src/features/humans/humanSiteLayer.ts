/**
 * Dated finds of humans and their relatives, in deep time: a name to tap at each site, coloured
 * by species, `human:<id>` when picked. Placed before the states' names, which never show then.
 * A layer on the globe's host (#379): `globe.addLayer(humanSiteLayer)`.
 */

import type { HumanSite } from '../../data/humanClaims';
import { SURFACE_PRIORITY, type LayerFactory } from '../../globe/layerHost';

export const humanSiteLayer: LayerFactory<readonly HumanSite[] | null> = (host) => {
  const layer = document.createElement('div');
  layer.className = 'empire-labels human-sites';
  host.container.append(layer);
  host.pickable(layer);
  const pins = host.surfaceLabels(SURFACE_PRIORITY.humans, layer);
  let shownKey = '';

  return {
    update(sites) {
      // Laying labels out is slow: not again for the same finds, as time plays on.
      const key = sites === null ? 'off' : sites.map((site) => site.id).join(' ');
      if (key === shownKey) return;
      shownKey = key;
      pins.show(
        sites?.map((site) => {
          const element = document.createElement('button');
          element.type = 'button';
          element.className = `empire-label human-site is-${site.species}${site.disputed ? ' is-disputed' : ''}`;
          element.textContent = site.label;
          element.dataset['site'] = site.id;
          element.dataset['pick'] = `human:${site.id}`;
          return { element, point: site.point };
        }) ?? null,
      );
      host.container.dataset['humans'] = sites === null ? 'off' : String(sites.length);
    },
  };
};
