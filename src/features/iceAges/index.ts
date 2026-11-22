/**
 * The ice ages' Earth as a feature (#380, #444, #909): on deep time's ice-age scale, the sea's
 * level and the shelf it left bare (NOAA's present-day depths), the ice sheets and Batchelor et
 * al.'s outlines, and the sea ice; while travelling through the Holocene, the same over today's
 * Earth. Each map's index loads the first time it is needed.
 */

import { feature, type FeatureContext, type FeatureInstance } from '../feature';
import { iceOutlineLayer } from './iceOutlineLayer';
import {
  ICE_AGES_MA,
  LAST_GLACIAL_MAXIMUM_MA,
  momentJulianDay,
  type ViewState,
} from '../../state/viewState';
import {
  loadSeaIce,
  type SeaIceIndex,
  seaIceMaps,
  seaIceMix,
  seaIceSeason,
} from '../../data/seaIce';
import { earthText } from '../../ui/historyTrack';
import type { CoastlineView, SeaIceView } from '../../ui/deepBarModel';
import type { DeepTimeView } from '../../ui/deepTimeBar';
import { framesAround } from '../../data/paleoDem';
import { loadSeaLevel, type SeaLevelIndex } from '../../data/seaLevel';
import {
  iceFramesInMa,
  iceStandIn,
  type IceStandIn,
  kaBeforePresent,
  loadIceSheets,
  oldestIceKa,
  type IceSheetIndex,
} from '../../data/iceSheets';
import {
  iceOutlinesAt,
  loadIceOutlines,
  type IceOutlineIndex,
  type IceOutlines,
} from '../../data/iceOutlines';
import { loadReliefTiles } from '../../data/reliefTiles';
import { loadShelf, type ShelfIndex } from '../../data/shelf';
import {
  COAST_SOURCES,
  coastlineAt,
  type Coastline,
  type CoastSource,
} from '../../deepTime/coastline';
import { loadOnce, reportAll } from '../../state/loadOnce';

const NEEDS = ['timeline', 'deepTime', 'iceAgeEarth', 'holoceneNote'] as const;
type IceAgesContext = FeatureContext<(typeof NEEDS)[number]>;

function mountIceAges(context: IceAgesContext): FeatureInstance {
  const { base, fetchJson } = context;
  const globe = context.iceAgeEarth;
  const iceOutlinesOnGlobe = context.globe.addLayer(iceOutlineLayer);
  // Each file asked for once, the first time it is needed, and drawn when it arrives (#762).
  const loads = {
    notify: (message: string) => {
      context.notify(message);
    },
    refresh: () => {
      context.deepTime.again();
    },
  };
  const seaLevel = loadOnce<SeaLevelIndex>({
    fetch: () => loadSeaLevel(`${base}data/sealevel/index.json`, fetchJson),
    what: 'the sea-level reconstructions',
    context: loads,
  });
  const shelf = loadOnce<ShelfIndex>({
    fetch: () => loadShelf(`${base}data/shelf/index.json`, fetchJson),
    what: "today's coasts and shelves",
    context: loads,
  });
  const iceMaps = loadOnce<IceSheetIndex>({
    fetch: () => loadIceSheets(`${base}data/icesheets/index.json`, fetchJson),
    what: 'the ice-sheet maps',
    context: loads,
  });
  const outlines = loadOnce<IceOutlineIndex>({
    fetch: () => loadIceOutlines(`${base}data/icesheets/batchelor.json`, fetchJson),
    what: 'the ice-sheet outlines',
    context: loads,
  });
  let layerOn = false;

  /** The sea-level reconstructions, asked for once; null until they arrive. */
  function seaLevels(): SeaLevelIndex | null {
    seaLevel.want();
    return seaLevel.value();
  }

  function seaLevelView(state: ViewState): DeepTimeView['seaLevel'] {
    return state.layers.has('sealevel') ? { on: true, index: seaLevels() } : { on: false };
  }

  /** Today's shelves, asked for once; null until they arrive. */
  function shelves(): ShelfIndex | null {
    shelf.want();
    return shelf.value();
  }

  // Batchelor et al.'s outlines: their file loads the first time the ice-age scale is shown.

  /** On the ice-age scale, Batchelor et al.'s outlines of the time slice shown, if any. */
  function showIceOutlines(state: ViewState, ma: number): IceOutlines | null {
    if (state.deepScale !== 'ice') {
      iceOutlinesOnGlobe.update(null);
      return null;
    }
    outlines.want();
    const iceOutlineIndex = outlines.value();
    if (iceOutlineIndex === null) return null;
    const shown = iceOutlinesAt(iceOutlineIndex, ma * 1000);
    iceOutlinesOnGlobe.update(shown);
    return shown;
  }

  /** The ice-sheet maps' index, asked for once; null until it arrives. */
  function iceSheets(): IceSheetIndex | null {
    iceMaps.want();
    return iceMaps.value();
  }

  /**
   * While travelling through the Holocene: the ice sheets and the sea level of the year, over
   * today's Earth: the shelf the lower sea left bare, and the ice that still lay on the land.
   */
  function showHoloceneEarth(state: ViewState): void {
    if (!context.timeline.travelling() || state.mode !== 'globe') {
      holoceneSea = null;
      context.holoceneNote.keep(null);
      showSeaIce(state, null);
      globe.setShelf(null);
      globe.setIce(null);
      return;
    }
    const ka = kaBeforePresent(state.time.date.year);
    const levels = seaLevels();
    const shelf = shelves();
    const coastline = levels === null ? null : coastlineAt(levels, state.coast, ka);
    holoceneSea = coastline;
    context.holoceneNote.keep(coastline === null ? null : earthText(coastline));
    showSeaIce(state, null);
    globe.setShelf(
      coastline === null || shelf === null
        ? null
        : {
            url: `${base}data/shelf/${shelf.file}`,
            columns: shelf.columns,
            rows: shelf.rows,
            lowest: shelf.lowest,
            highest: shelf.highest,
            seaLevel: coastline.seaLevel,
          },
    );
    const ice = iceSheets();
    if (ice === null) {
      globe.setIce(null);
      context.holoceneNote.shown();
      return;
    }
    const { younger, older, mix } = framesAround(iceFramesInMa(ice), ka / 1000);
    globe.setIce({
      younger: `${base}data/icesheets/${younger.file}`,
      older: `${base}data/icesheets/${older.file}`,
      mix,
      columns: ice.columns,
      rows: ice.rows,
      metresPerStep: ice.metresPerStep,
    });
    context.holoceneNote.shown();
  }
  let holoceneSea: Coastline | null = null;

  /** On the ice-age scale, the ice sheets of the moment, where the maps reach. */
  function showIce(state: ViewState, ma: number): DeepTimeView['ice'] {
    if (state.deepScale !== 'ice') {
      globe.setIce(null);
      return { drawn: false, oldestKa: null, standIn: null };
    }
    const index = iceSheets();
    if (index === null) return { drawn: false, oldestKa: null, standIn: null };
    const oldestKa = oldestIceKa(index);
    if (ma * 1000 > oldestKa) {
      const standIn = iceStandInFor(state, ma, index);
      globe.setIce(
        standIn === null
          ? null
          : {
              younger: `${base}data/icesheets/${standIn.file}`,
              older: `${base}data/icesheets/${standIn.file}`,
              mix: 0,
              columns: index.columns,
              rows: index.rows,
              metresPerStep: index.metresPerStep,
            },
      );
      return { drawn: standIn !== null, oldestKa, standIn };
    }
    const { younger, older, mix } = framesAround(iceFramesInMa(index), ma);
    globe.setIce({
      younger: `${base}data/icesheets/${younger.file}`,
      older: `${base}data/icesheets/${older.file}`,
      mix,
      columns: index.columns,
      rows: index.rows,
      metresPerStep: index.metresPerStep,
    });
    return { drawn: true, oldestKa, standIn: null };
  }

  // Sea ice: its index loads the first time a globe of Earth is shown.
  const seaIce = loadOnce<SeaIceIndex>({
    fetch: () => loadSeaIce(`${base}data/seaice/index.json`, fetchJson),
    what: 'the sea-ice maps',
    context: loads,
  });

  /**
   * Sea ice blended from today's towards the chosen model's: on the ice-age scale, and in the
   * years (ma null) by the time of year, at the travelled year's sea level or else today's.
   */
  function showSeaIce(state: ViewState, ma: number | null): SeaIceView | null {
    if (ma !== null && state.deepScale !== 'ice') {
      globe.setSeaIce(null);
      return null;
    }
    seaIce.want();
    const seaIceIndex = seaIce.value();
    if (seaIceIndex === null) return { model: state.seaIce, mix: null };
    const maps = seaIceMaps(seaIceIndex, state.seaIce, `${base}data/seaice/`);
    const levels = seaLevels();
    const ago = ma === null || levels === null ? null : coastlineAt(levels, state.coast, ma * 1000);
    const at = ma === null ? holoceneSea : ago;
    if (maps === null || (ma !== null && at === null)) {
      globe.setSeaIce(null);
      return { model: state.seaIce, mix: null };
    }
    // How far the sea had fallen towards its glacial low, by the same source.
    const source: CoastSource = COAST_SOURCES.find((id) => id === at?.series.id) ?? state.coast;
    const glacial =
      levels === null ? null : coastlineAt(levels, source, LAST_GLACIAL_MAXIMUM_MA * 1000);
    const mix = at === null ? 0 : seaIceMix(at.seaLevel, glacial?.seaLevel ?? -120);
    const season = ma === null ? seaIceSeason(momentJulianDay(state.time)) : null;
    globe.setSeaIce({ ...maps, mix, season });
    return { model: state.seaIce, mix };
  }

  /** Before the ice maps reach: the map whose sea level, by the coastline's source, matches. */
  function iceStandInFor(state: ViewState, ma: number, index: IceSheetIndex): IceStandIn | null {
    const levels = seaLevels();
    if (levels === null) return null;
    const now = coastlineAt(levels, state.coast, ma * 1000);
    if (now === null) return null;
    // The same source throughout, so the levels compare like with like.
    const source: CoastSource = COAST_SOURCES.find((id) => id === now.series.id) ?? state.coast;
    return iceStandIn(
      index,
      now.seaLevel,
      (ka) => coastlineAt(levels, source, ka)?.seaLevel ?? null,
    );
  }

  /**
   * Over the ice ages, on either scale, coastlines from NOAA's present-day depths at the sea
   * level of the moment, by the source chosen: the elevation maps' 8-bit heights cannot tell a
   * strait a few metres deep from land.
   */
  let reliefAsked = false;
  /** Close up, today's heights in tiles (#1016): asked for once, where the device takes tiles. */
  function tileRelief(): void {
    if (reliefAsked || globe.tileLimits === null) return;
    reliefAsked = true;
    const folder = `${base}textures/relief-tiles/`;
    loadReliefTiles(`${folder}manifest.json`, fetchJson).then(
      (tiles) => {
        globe.setEarthTiles(tiles, folder);
      },
      // Not asked again: the globe's own map stays, as it would without tiles.
      (error: unknown) => {
        console.warn('Could not load the list of relief tiles:', error);
      },
    );
  }

  function showCoastline(ma: number, state: ViewState): CoastlineView | null {
    if (ma > ICE_AGES_MA) {
      globe.setShelf(null);
      return null;
    }
    const levels = seaLevels();
    const coastline = levels === null ? null : coastlineAt(levels, state.coast, ma * 1000);
    const shelf = shelves();
    globe.setShelf(
      coastline === null || shelf === null
        ? null
        : {
            url: `${base}data/shelf/${shelf.file}`,
            columns: shelf.columns,
            rows: shelf.rows,
            lowest: shelf.lowest,
            highest: shelf.highest,
            seaLevel: coastline.seaLevel,
          },
    );
    if (coastline !== null && shelf !== null) tileRelief();
    return {
      coast: state.coast,
      seaLevel: coastline?.seaLevel ?? null,
      label: coastline?.series.label ?? null,
      instead: coastline?.instead?.label ?? null,
    };
  }

  return {
    // Out of deep time: the Holocene's Earth while travelling, or today's sea ice alone.
    deep(state, moment) {
      if (moment !== null) return null;
      showHoloceneEarth(state);
      iceOutlinesOnGlobe.update(null);
      return null;
    },
    // What deep time's bar says of them, drawing them on the globe for the moment.
    load: () => reportAll(layerOn, [seaLevel, shelf, iceMaps, outlines, seaIce]),
    deepBar(state, { ma }) {
      layerOn = state.layers.has('sealevel');
      return {
        coastline: showCoastline(ma, state),
        ice: showIce(state, ma),
        iceOutlines: showIceOutlines(state, ma),
        seaIce: showSeaIce(state, ma),
        seaLevel: seaLevelView(state),
      };
    },
  };
}

/** The ice ages' Earth, under the sea-level layer's name: the layer of its own it has. */
export const iceAgesFeature = feature({
  id: 'sealevel',
  needs: NEEDS,
  watches: (state) => [state.layers, state.ma, state.deepScale, state.coast, state.seaIce],
  mount: mountIceAges,
});

export { createHoloceneNote } from './holoceneNote';
