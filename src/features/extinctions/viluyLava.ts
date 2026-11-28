/**
 * The Late Devonian's clock with the Viluy Traps' lava beside its seas (#1230): drawn over the
 * area Kravchinsky (2012) lists, held at its fullest through the clock, since its dates
 * (Courtillot et al. 2010; Ricci et al. 2013) place it near the crisis but cannot set it against
 * the two Kellwasser pulses.
 */

import type { GeoPoint } from '../../core/geo';
import type { OwnTimeEvent } from '../ownTime';
import type { DrawnEvent } from './seasEvents';
import { fumesLayer } from './fumesLayer';
import { PROVINCE_LEGEND } from './legends';
import { EXTENTS } from './provinceExtents';

/** Its plumes, pale and steady: drawn, not measured. */
const FUMING = { lava: 0.5, gas: 0, haze: 0.1 } as const;

/** `crisis` with the Viluy Traps at `viluy` fuming beside it. */
export function withViluy(crisis: DrawnEvent, viluy: GeoPoint): OwnTimeEvent {
  const lava = PROVINCE_LEGEND.filter(([swatch]) => swatch === 'lava' || swatch === 'basalt');
  return {
    ...crisis,
    drawn: `${crisis.drawn} The Viluy Traps’ smoke and lava are drawn to illustrate, held steady through the clock: their dates put them near the crisis, not at either pulse. ${EXTENTS.viluy.says}`,
    legend: [...crisis.legend, ...lava],
    play(tools) {
      const seas = crisis.play(tools);
      const fumes = tools.layer(fumesLayer);
      return {
        at(seconds) {
          fumes.update({ center: viluy, spread: EXTENTS.viluy.spread, fuming: FUMING, cover: 1 });
          seas.at(seconds);
        },
        end() {
          seas.end();
          fumes.update(null);
        },
      };
    },
  };
}
