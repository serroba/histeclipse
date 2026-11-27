/**
 * Key facts pinned where they happened (#1268): as an extinction's clock reaches each, a short
 * card beside its place says it, with whose study it is. Laid out with the globe's other names,
 * ahead of the places' own, so a fact is not hidden behind them. A layer on the globe's host:
 * `globe.addLayer(factsLayer)`.
 */

import type { GeoPoint } from '../../core/geo';
import { SURFACE_PRIORITY, type LayerFactory } from '../../globe/layerHost';
import './extinctions.css';

/** A fact shown: where, what it says, and whose. */
export interface PinnedFact {
  readonly id: string;
  readonly point: GeoPoint;
  readonly text: string;
  /** Whose study: "Wu et al. 2021". */
  readonly source: string;
}

export const factsLayer: LayerFactory<readonly PinnedFact[] | null> = (host) => {
  const layer = document.createElement('div');
  layer.className = 'empire-labels extinction-facts';
  host.container.append(layer);
  // Just ahead of the places' names, which give way to it.
  const pins = host.surfaceLabels(SURFACE_PRIORITY.extinctions - 1, layer);
  let shownKey = '';

  return {
    update(facts) {
      const key = facts === null ? '' : facts.map(({ id }) => id).join(' ');
      host.container.dataset['facts'] = facts === null ? '0' : String(facts.length);
      // The same facts: moved with their plates, not made again.
      if (key === shownKey) {
        if (facts !== null) pins.move(facts.map(({ point }) => point));
        return;
      }
      shownKey = key;
      pins.show(
        facts?.map(({ point, text, source }) => {
          const element = document.createElement('div');
          element.className = 'empire-label extinction-fact';
          const said = document.createElement('span');
          said.className = 'extinction-fact-text';
          said.textContent = text;
          const whose = document.createElement('span');
          whose.className = 'extinction-fact-source';
          whose.textContent = source;
          element.append(said, whose);
          return { element, point };
        }) ?? null,
      );
    },
  };
};
