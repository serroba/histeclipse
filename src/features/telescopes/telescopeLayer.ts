/**
 * The ground telescopes on the globe (#848): a marker at each site working or being built in the
 * year shown, named, `telescope:<ids>` when picked; one being built drawn hollow. A layer on the
 * globe's host (#379): `globe.addLayer(telescopeLayer)`.
 */

import { SURFACE_PRIORITY, type LayerFactory } from '../../globe/layerHost';
import type { TelescopeMark } from './telescopeMarks';

export const telescopeLayer: LayerFactory<readonly TelescopeMark[] | null> = (host) => {
  const layer = document.createElement('div');
  layer.className = 'empire-labels telescope-marks';
  host.container.append(layer);
  host.pickable(layer);
  const pins = host.surfaceLabels(SURFACE_PRIORITY.telescopes, layer);
  // What is shown, so a moment with the same telescopes changes nothing on the page.
  let shownKey = '';

  return {
    update(marks) {
      const key =
        marks === null
          ? 'off'
          : marks.map((mark) => `${mark.key}:${String(mark.building)}`).join(' ');
      if (key === shownKey) return;
      shownKey = key;
      pins.show(
        marks?.map((mark) => {
          const element = document.createElement('button');
          element.type = 'button';
          element.className = `empire-label telescope-mark${mark.building ? ' is-building' : ''}`;
          element.dataset['pick'] = `telescope:${mark.key}`;
          const name = document.createElement('span');
          name.className = 'impact-name';
          name.textContent = mark.name;
          element.append(name);
          element.setAttribute(
            'aria-label',
            `${mark.name}${mark.building ? ' (being built)' : ''}: details`,
          );
          return { element, point: mark.point };
        }) ?? null,
      );
      host.container.dataset['telescopes'] = marks === null ? 'off' : String(marks.length);
    },
  };
};
