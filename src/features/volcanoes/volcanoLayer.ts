/**
 * Volcanoes erupting near the year shown (Smithsonian GVP), in historical time: a marker to tap
 * for each, sized by its eruption's VEI, the largest named, `volcano:<number>` when picked.
 * A layer on the globe's host (#379): `globe.addLayer(volcanoLayer)`.
 */

import type { VolcanoMark } from '../../data/volcanoes';
import { SURFACE_PRIORITY, type LayerFactory } from '../../globe/layerHost';

export const volcanoLayer: LayerFactory<readonly VolcanoMark[] | null> = (host) => {
  const layer = document.createElement('div');
  layer.className = 'empire-labels volcano-marks';
  host.container.append(layer);
  host.pickable(layer);
  const pins = host.surfaceLabels(SURFACE_PRIORITY.volcanoes, layer);
  // What is shown, so a moment with the same eruptions changes nothing on the page.
  let shownKey = '';

  return {
    update(marks) {
      const key =
        marks === null
          ? 'off'
          : marks
              .map(
                ({ volcano, eruptions }) => `${String(volcano.number)}:${String(eruptions.length)}`,
              )
              .join(' ');
      if (key === shownKey) return;
      shownKey = key;
      pins.show(
        marks?.map(({ volcano, vei, uncertain }) => {
          const element = document.createElement('button');
          element.type = 'button';
          element.className = `empire-label volcano-mark${uncertain ? ' is-uncertain' : ''}`;
          element.dataset['pick'] = `volcano:${String(volcano.number)}`;
          // Larger for a larger eruption: from 10 pixels (VEI unknown or 0) to 34 (VEI 8).
          const size = 10 + 3 * Math.max(0, vei ?? 0);
          element.style.setProperty('--size', `${String(size)}px`);
          // The largest are named; every one says what it is to a screen reader.
          if ((vei ?? 0) >= 4) {
            const name = document.createElement('span');
            name.className = 'impact-name';
            name.textContent = volcano.name;
            element.append(name);
          }
          element.setAttribute('aria-label', `${volcano.name}: details`);
          return {
            element,
            point: { latitude: volcano.latitude, longitude: volcano.longitude },
          };
        }) ?? null,
      );
      host.container.dataset['volcanoes'] = marks === null ? 'off' : String(marks.length);
    },
  };
};
