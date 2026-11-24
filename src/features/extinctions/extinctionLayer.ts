/**
 * The great extinctions (#1190), in deep time: a marker to tap for each place, its cause's
 * larger than where it is dated, named, `extinction:<site>` when picked; they drift with their
 * plates. A layer on the globe's host (#379): `globe.addLayer(extinctionLayer)`.
 */

import { SURFACE_PRIORITY, type LayerFactory } from '../../globe/layerHost';
import type { ExtinctionMark } from './view';
import './extinctions.css';

export const extinctionLayer: LayerFactory<readonly ExtinctionMark[] | null> = (host) => {
  const layer = document.createElement('div');
  layer.className = 'empire-labels extinction-marks';
  host.container.append(layer);
  host.pickable(layer);
  const pins = host.surfaceLabels(SURFACE_PRIORITY.extinctions, layer);
  let shownKey = '';

  return {
    update(marks) {
      const key = marks === null ? 'off' : marks.map(({ site }) => site.id).join(' ');
      // The same places as before (as time plays, they drift with their plates): moved.
      if (key === shownKey) {
        if (marks !== null) pins.move(marks.map(({ point }) => point));
        return;
      }
      shownKey = key;
      pins.show(
        marks?.map(({ site, extinction, point }) => {
          const element = document.createElement('button');
          element.type = 'button';
          element.className = `empire-label extinction-mark is-${site.role}`;
          element.dataset['pick'] = `extinction:${site.id}`;
          const name = document.createElement('span');
          name.className = 'extinction-name';
          name.textContent = site.name;
          element.append(name);
          element.setAttribute('aria-label', `${site.name}, ${extinction.title}: details`);
          return { element, point };
        }) ?? null,
      );
      host.container.dataset['extinctions'] = marks === null ? 'off' : String(marks.length);
    },
  };
};
