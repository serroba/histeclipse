/**
 * The strike's ground on the globe (#1175, #1176): the layer that sets the strike-ground part of
 * the Earth shader (`strikeGroundPart.ts`) at each moment of the strike clock.
 */

import type { GeoPoint } from '../../state/viewState';
import { geoToVector } from '../../globe/geo';
import type { LayerFactory } from '../../globe/layerHost';
import { strikeGround } from './groundModel';
import { STRIKE_GROUND_PART } from './strikeGroundPart';

/** A strike at `place`, `seconds` after it struck, reaching `worldwide` of the way round. */
export interface StrikeMoment {
  readonly place: GeoPoint;
  readonly seconds: number;
  readonly worldwide: number;
}

/** The ground round the strike at the moment given; null takes it away. */
export const strikeGroundLayer: LayerFactory<StrikeMoment | null> = (host) => {
  const uniforms = host.earthPart(STRIKE_GROUND_PART);
  return {
    update(moment) {
      uniforms.strikeActive.value = moment === null ? 0 : 1;
      host.container.dataset['strikeGround'] = moment === null ? 'off' : 'on';
      if (moment !== null) {
        const ground = strikeGround(moment.seconds, moment.worldwide);
        uniforms.strikeCenter.value.set(...geoToVector(moment.place, 1)).normalize();
        uniforms.strikeCrater.value = [
          ground.cavityKm,
          ground.depth,
          ground.uplift,
          ground.peakRing,
        ];
        uniforms.strikeSpread.value = [
          ground.rim,
          ground.blanketReach,
          ground.blanket,
          ground.tsunamiFront,
        ];
        uniforms.strikeTsunami.value = ground.tsunami;
      }
      host.requestRender();
    },
  };
};
