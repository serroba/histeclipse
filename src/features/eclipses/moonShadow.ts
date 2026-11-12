/**
 * The selected solar eclipse's shadow at the moment shown (#379): the layer that sets the Moon's
 * shadow's part of the Earth shader (moonShadowPart.ts) from the catalog's shadow geometry. With
 * none, the part draws the Moon's shadow from where the Sun and Moon are.
 */

import type { ShadowGeometry } from '../../eclipses/solar';
import type { LayerFactory } from '../../globe/layerHost';
import { MOON_SHADOW_PART } from './moonShadowPart';

const TO_RADIANS = Math.PI / 180;

/** The catalog's shadow for a selected solar eclipse; null leaves it to the geometry. */
export const moonShadowLayer: LayerFactory<ShadowGeometry | null> = (host) => {
  const uniforms = host.earthPart(MOON_SHADOW_PART);
  return {
    update(shadow) {
      uniforms.solarActive.value = shadow === null ? 0 : 1;
      if (shadow !== null) {
        uniforms.shadowAxis.value.set(
          shadow.x,
          shadow.y,
          shadow.d * TO_RADIANS,
          shadow.mu * TO_RADIANS,
        );
        uniforms.shadowCones.value.set(shadow.l1, shadow.l2, shadow.tanF1, shadow.tanF2);
      }
      host.container.dataset['solarShadow'] = shadow === null ? 'off' : 'on';
      host.requestRender();
    },
  };
};
