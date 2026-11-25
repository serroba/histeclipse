/**
 * Earth growing on the formation clock (#1219): the globe drawn at the proto-Earth's size, as
 * the chosen model gives it, until Theia strikes; given null, at its own size again. A layer on
 * the globe's host that asks for the `earthSize` capability.
 */

import { needing } from '../../globe/layerCapabilities';

export const growthLayer = needing<number | null, 'earthSize'>(['earthSize'], (host) => ({
  update(share) {
    host.earthSize(share ?? 1);
  },
}));
