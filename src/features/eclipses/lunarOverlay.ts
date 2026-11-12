/**
 * Where a lunar eclipse could be seen (#379): the ground where the eclipsed Moon was up, as if lit
 * by a copper Moon, the band ΔT leaves uncertain hatched, and a ring where it stood overhead. The
 * layer that sets the lunar overlay's part of the Earth shader (lunarOverlayPart.ts).
 */

import type { Vector3Tuple } from '../../globe/geo';
import type { LayerFactory } from '../../globe/layerHost';
import { LUNAR_OVERLAY_PART } from './lunarOverlayPart';

/** Where an eclipsed Moon was overhead, nominally and at ±1σ of ΔT. */
export interface LunarOverlay {
  readonly sublunar: Vector3Tuple;
  readonly west: Vector3Tuple;
  readonly east: Vector3Tuple;
  /** 0 to 1: fainter during the barely visible penumbral phase. */
  readonly strength: number;
}

/** Where the eclipsed Moon is up now; null hides it. */
export const lunarOverlayLayer: LayerFactory<LunarOverlay | null> = (host) => {
  const uniforms = host.earthPart(LUNAR_OVERLAY_PART);
  return {
    update(overlay) {
      uniforms.lunarActive.value = overlay === null ? 0 : overlay.strength;
      if (overlay !== null) {
        uniforms.moonCenter.value.set(...overlay.sublunar).normalize();
        uniforms.moonWest.value.set(...overlay.west).normalize();
        uniforms.moonEast.value.set(...overlay.east).normalize();
      }
      host.container.dataset['lunarOverlay'] = overlay === null ? 'off' : 'on';
      host.requestRender();
    },
  };
};
