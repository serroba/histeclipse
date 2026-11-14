/**
 * Close up, a sharper map for the body in focus, fetched once (#258); over Earth, closer still,
 * its full-size map in tiles (#568). Earth's largest map only where the graphics hold it and the
 * screen is not a phone's, whose memory it would strain: there the 4096 map. Its tiles wherever
 * the graphics take them on, phones too, within the device's limits (`tileLimits.ts`, #578).
 */

import { loadEarthTiles } from '../../data/earthTiles';
import { isMoonBody } from '../../globe/moonLook';
import { EARTH_TILES, SHARP_MAPS } from '../../globe/planetLook';
import type { Globe } from '../../globe/globe';
import type { ViewState } from '../../state/viewState';
import type { Fetch } from '../../util/fetchJson';

/** Within this many radii of the body in focus, its sharper map is fetched (#258). */
export const SHARP_WITHIN = 2.5;

export interface SharpenContext {
  readonly base: string;
  readonly fetchJson: Fetch;
  readonly globe: Pick<
    Globe,
    'maxTextureSize' | 'setBodyMap' | 'setEarthTiles' | 'sharpenPlanet' | 'tileLimits'
  >;
}

/** Sharpen the body in focus if the view is close enough: as the view changes. */
export function createSharpener({
  base,
  fetchJson,
  globe,
}: SharpenContext): (state: ViewState) => void {
  const largeMaps = globe.maxTextureSize >= 8192 && !window.matchMedia('(pointer: coarse)').matches;

  let tilesAsked = false;
  /** Hand the globe Earth's tiles; it draws those in view once close enough. */
  function tileEarth(): void {
    if (tilesAsked) return;
    tilesAsked = true;
    loadEarthTiles(`${base}${EARTH_TILES}manifest.json`, fetchJson).then(
      (tiles) => {
        globe.setEarthTiles(tiles, `${base}${EARTH_TILES}`);
      },
      // Not asked again: the sharp map beneath stays, as it would without tiles.
      (error: unknown) => {
        console.warn('Could not load the list of Earth’s tiles:', error);
      },
    );
  }

  return (state) => {
    if (state.mode !== 'globe' || state.ma !== null || state.camera.distance > SHARP_WITHIN) return;
    const { focus } = state;
    if (focus === 'earth' || focus === 'moon') {
      const sizes = SHARP_MAPS[focus];
      globe.setBodyMap(focus, `${base}${largeMaps ? sizes.large : sizes.small}`);
      if (focus === 'earth' && globe.tileLimits !== null) tileEarth();
      return;
    }
    if (focus === 'sun' || isMoonBody(focus)) return;
    globe.sharpenPlanet(focus);
  };
}
