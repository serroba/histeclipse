/**
 * Impact craters and deposits (Impact Earth), in either time: a marker to tap for each, sized by
 * diameter, the largest named, `impact:<id>` when picked. In deep time they drift with their
 * plates. A layer on the globe's host (#379): `globe.addLayer(impactLayer)`.
 */

import type { ImpactMark } from '../data/impacts';
import { SURFACE_PRIORITY, type LayerFactory } from './layerHost';
import './impactLayer.css';

export const impactLayer: LayerFactory<readonly ImpactMark[] | null> = (host) => {
  const layer = document.createElement('div');
  layer.className = 'empire-labels impact-marks';
  host.container.append(layer);
  host.pickable(layer);
  const pins = host.surfaceLabels(SURFACE_PRIORITY.impacts, layer);
  let shownKey = '';

  return {
    update(marks) {
      const key =
        marks === null
          ? 'off'
          : marks
              .map(({ impact, uncertain }) => `${String(impact.id)}${uncertain ? '?' : ''}`)
              .join(' ');
      // The same craters as before (as time plays, they drift with their plates): moved.
      if (key === shownKey) {
        if (marks !== null) pins.move(marks.map(({ point }) => point));
        return;
      }
      shownKey = key;
      pins.show(
        marks?.map(({ impact, point, uncertain }) => {
          const element = document.createElement('button');
          element.type = 'button';
          element.className = `empire-label impact-mark is-${impact.kind}${uncertain ? ' is-uncertain' : ''}`;
          element.dataset['pick'] = `impact:${String(impact.id)}`;
          const diameter = impact.diameterKm ?? 0;
          // Wider for larger craters, gently: a logarithm, from 9 to 26 pixels.
          const size = Math.round(Math.min(26, 9 + 3 * Math.log2(1 + diameter / 4)));
          element.style.setProperty('--size', `${String(size)}px`);
          // The largest are named; every one says what it is to a screen reader.
          if (diameter >= 40) {
            const name = document.createElement('span');
            name.className = 'impact-name';
            name.textContent = impact.name;
            element.append(name);
          }
          element.setAttribute('aria-label', `${impact.name}: details`);
          return { element, point };
        }) ?? null,
      );
      host.container.dataset['impacts'] = marks === null ? 'off' : String(marks.length);
    },
  };
};
