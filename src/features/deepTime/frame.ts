/**
 * From the years into the maps of moved continents (#948): today's place means nothing there,
 * so the globe turns to where the reconstructions keep their land (Gondwana, then Pangaea, then
 * Africa, about 20°S on their meridian) and draws back to show the whole of it.
 */

import type { Globe } from '../../globe/globe';

const DEEP_EARTH_FRAME = { latitude: -20, longitude: 0 };
const DEEP_EARTH_DISTANCE = 4.5;

export function frameDeepEarth(globe: Pick<Globe, 'flyTo' | 'zoomTo'>, distance: number): void {
  globe.flyTo(DEEP_EARTH_FRAME);
  if (distance < DEEP_EARTH_DISTANCE) globe.zoomTo(DEEP_EARTH_DISTANCE);
}
