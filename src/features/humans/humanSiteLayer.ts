/**
 * Dated finds of humans and their relatives, in deep time: a name to tap at each site, coloured
 * by species, `human:<id>` when picked; a ring pulses about a find as it appears while time plays,
 * and a disputed find's dot is a dashed ring. Placed before the states' names, which never show then.
 * A layer on the globe's host (#379): `globe.addLayer(humanSiteLayer)`.
 */

import type { HumanSite } from '../../data/humanClaims';
import { SURFACE_PRIORITY, type LayerFactory } from '../../globe/layerHost';
import './humanSites.css';

/** The most finds that pulse at once: more, and it is a jump, not time playing. */
const PULSE_MOST = 4;

export const humanSiteLayer: LayerFactory<readonly HumanSite[] | null> = (host) => {
  const layer = document.createElement('div');
  layer.className = 'empire-labels human-sites';
  host.container.append(layer);
  host.pickable(layer);
  const pins = host.surfaceLabels(SURFACE_PRIORITY.humans, layer);
  let shownKey = '';
  // The finds already marked: those new since, a few at a time as time plays, pulse (#177).
  let marked: ReadonlySet<string> | null = null;

  return {
    update(sites) {
      // Laying labels out is slow: not again for the same finds, as time plays on.
      const key = sites === null ? 'off' : sites.map((site) => site.id).join(' ');
      if (key === shownKey) return;
      shownKey = key;
      const fresh = (id: string) => marked !== null && !marked.has(id);
      // Not on a first look, nor on a jump that brings many at once: only as time plays.
      const pulse = sites !== null && sites.filter((site) => fresh(site.id)).length <= PULSE_MOST;
      pins.show(
        sites?.map((site) => {
          const element = document.createElement('button');
          element.type = 'button';
          element.className = `empire-label human-site is-${site.species}${site.disputed ? ' is-disputed' : ''}${site.dna === true ? ' is-dna' : ''}${pulse && fresh(site.id) ? ' is-new' : ''}`;
          element.textContent = site.label;
          element.dataset['site'] = site.id;
          element.dataset['pick'] = `human:${site.id}`;
          // The middle of its 7-pixel dot (humanSites.css) goes on the site (#1010).
          return { element, point: site.point, anchor: 3.5 };
        }) ?? null,
      );
      host.container.dataset['humans'] = sites === null ? 'off' : String(sites.length);
      marked = sites === null ? null : new Set(sites.map((site) => site.id));
    },
  };
};
