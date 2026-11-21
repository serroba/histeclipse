/**
 * The layers a trip through the years brings (#983). Playing turns on the travel view, which
 * brings borders and how people lived (`travelBrings`): it says so the first time, and a layer
 * the reader turns off during a trip stays off on the next, for the rest of the visit. Leaving
 * the travel view takes away what it brought and the reader left on, as before.
 */

import { layerEntry, type Layer } from '../../layers/layers';
import type { GeoPoint } from '../../state/viewState';
import { travelBrings } from './windowing';

export interface TravelTrip {
  /** A trip starts with these layers on: the ones to bring, and a note the first time it does. */
  open(layers: ReadonlySet<Layer>): {
    readonly bring: readonly Layer[];
    readonly note: string | null;
  };
  /** The trip ends: the layers it brought that are still on, to take away. */
  close(): readonly Layer[];
  /** The layers on during a trip: one it brought and the reader turned off is not brought again. */
  seen(layers: ReadonlySet<Layer>): void;
}

/** What the reader is told the first time a trip brings layers. */
export function broughtNote(layers: readonly Layer[]): string {
  const names = layers.map((layer) => layerEntry(layer).label).join(' and ');
  const one = layers.length === 1;
  return `Travel view turned on ${names}. Turn ${one ? 'it' : 'them'} off in Layers and ${
    one ? 'it stays' : 'they stay'
  } off.`;
}

export function travelTrip(): TravelTrip {
  let brought: readonly Layer[] = [];
  const declined = new Set<Layer>();
  let told = false;
  return {
    open(layers) {
      brought = travelBrings(layers).filter((layer) => !declined.has(layer));
      const note = told || brought.length === 0 ? null : broughtNote(brought);
      if (note !== null) told = true;
      return { bring: brought, note };
    },
    close() {
      const taken = brought;
      brought = [];
      return taken;
    },
    seen(layers) {
      for (const layer of brought.filter((each) => !layers.has(each))) declined.add(layer);
      brought = brought.filter((layer) => layers.has(layer));
    },
  };
}

/**
 * Where the Holocene's first change is to be seen (#984): the Fertile Crescent, where farming
 * began as the Holocene did and the first towns and states followed. From the default view
 * (Australia, for a reader there) a trip from 9700 BCE showed nothing changing for minutes.
 */
export const FIRST_FARMERS: GeoPoint = { latitude: 35, longitude: 40 };

/**
 * Turns the globe as a trip starts, once a visit (#984): to the first farmers, when Play goes
 * back to the start of the whole Holocene. After that the reader's camera is theirs.
 */
export function tripTurn(globe: { flyTo(place: GeoPoint): void }): {
  start(fromHolocene: boolean): void;
} {
  let turned = false;
  return {
    start(fromHolocene) {
      if (turned || !fromHolocene) return;
      turned = true;
      globe.flyTo(FIRST_FARMERS);
    },
  };
}
