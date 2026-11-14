/**
 * The ice ages' Earth as a part of the page (#444): on deep time's ice-age scale, the sea's
 * level and the shelf it left bare (NOAA's present-day depths), the ice sheets and Batchelor et
 * al.'s outlines, and the sea ice; while travelling through the Holocene, the same over today's
 * Earth. Each map's index loads the first time it is needed.
 */

import type { Globe } from '../../globe/globe';
import type { PartContext } from '../part';
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
import { loadShelf, type ShelfIndex } from '../../data/shelf';
import {
  COAST_SOURCES,
  coastlineAt,
  type Coastline,
  type CoastSource,
} from '../../deepTime/coastline';
import { errorMessage } from '../../util/errors';

/** What the ice ages ask of the rest of the page. */
export interface IceAgesContext extends Pick<PartContext, 'base' | 'fetchJson' | 'notify'> {
  readonly globe: Pick<Globe, 'addLayer' | 'setShelf' | 'setIce' | 'setSeaIce'>;
  /** Whether the reader is travelling through the years. */
  travelling(): boolean;
  /** Show deep time again: a map's index has arrived. */
  redraw(): void;
  /** The Holocene's Earth was drawn: the years' track says what it shows. */
  holoceneShown(state: ViewState): void;
}

export interface IceAgesPart {
  /** What deep time's bar says of them, drawing them on the globe for the moment `ma`. */
  readonly bar: (
    state: ViewState,
    ma: number,
  ) => Pick<DeepTimeView, 'coastline' | 'ice' | 'iceOutlines' | 'seaIce' | 'seaLevel'>;
  /** Out of deep time: the Holocene's Earth while travelling, or nothing. */
  readonly off: (state: ViewState) => void;
  readonly showHolocene: (state: ViewState) => void;
  /** What the years' track says of the Holocene's Earth, while it shows. */
  readonly holoceneText: () => string | null;
}

export function mountIceAges(context: IceAgesContext): IceAgesPart {
  const { base, fetchJson, globe } = context;
  const iceOutlinesOnGlobe = globe.addLayer(iceOutlineLayer);
  // Sea level, likewise: asked for once, drawn when it arrives.
  let seaLevelLoading: Promise<SeaLevelIndex> | null = null;
  let seaLevelIndex: SeaLevelIndex | null = null;
  let shelfLoading: Promise<ShelfIndex> | null = null;
  let shelfIndex: ShelfIndex | null = null;
  let iceLoading: Promise<IceSheetIndex> | null = null;
  let iceIndex: IceSheetIndex | null = null;

  /** The sea-level reconstructions, asked for once; null until they arrive. */
  function seaLevels(): SeaLevelIndex | null {
    if (seaLevelIndex === null && seaLevelLoading === null) {
      seaLevelLoading = loadSeaLevel(`${base}data/sealevel/index.json`, fetchJson);
      seaLevelLoading.then(
        (index) => {
          seaLevelIndex = index;
          context.redraw();
        },
        (error: unknown) => {
          seaLevelLoading = null;
          context.notify(`Could not load the sea-level reconstructions: ${errorMessage(error)}`);
        },
      );
    }
    return seaLevelIndex;
  }

  function seaLevelView(state: ViewState): DeepTimeView['seaLevel'] {
    return state.layers.has('sealevel') ? { on: true, index: seaLevels() } : { on: false };
  }

  /** Today's shelves, asked for once; null until they arrive. */
  function shelves(): ShelfIndex | null {
    if (shelfIndex === null && shelfLoading === null) {
      shelfLoading = loadShelf(`${base}data/shelf/index.json`, fetchJson);
      shelfLoading.then(
        (index) => {
          shelfIndex = index;
          context.redraw();
        },
        (error: unknown) => {
          shelfLoading = null;
          context.notify(`Could not load today's coasts and shelves: ${errorMessage(error)}`);
        },
      );
    }
    return shelfIndex;
  }

  // Batchelor et al.'s outlines: their file loads the first time the ice-age scale is shown.
  let iceOutlineIndex: IceOutlineIndex | null = null;
  let iceOutlinesLoading: Promise<IceOutlineIndex> | null = null;

  /** On the ice-age scale, Batchelor et al.'s outlines of the time slice shown, if any. */
  function showIceOutlines(state: ViewState, ma: number): IceOutlines | null {
    if (state.deepScale !== 'ice') {
      iceOutlinesOnGlobe.update(null);
      return null;
    }
    if (iceOutlineIndex === null) {
      if (iceOutlinesLoading === null) {
        iceOutlinesLoading = loadIceOutlines(`${base}data/icesheets/batchelor.json`, fetchJson);
        iceOutlinesLoading.then(
          (index) => {
            iceOutlineIndex = index;
            context.redraw();
          },
          (error: unknown) => {
            iceOutlinesLoading = null;
            context.notify(`Could not load the ice-sheet outlines: ${errorMessage(error)}`);
          },
        );
      }
      return null;
    }
    const outlines = iceOutlinesAt(iceOutlineIndex, ma * 1000);
    iceOutlinesOnGlobe.update(outlines);
    return outlines;
  }

  /** The ice-sheet maps' index, asked for once; null until it arrives. */
  function iceSheets(): IceSheetIndex | null {
    if (iceIndex === null && iceLoading === null) {
      iceLoading = loadIceSheets(`${base}data/icesheets/index.json`, fetchJson);
      iceLoading.then(
        (index) => {
          iceIndex = index;
          context.redraw();
        },
        (error: unknown) => {
          iceLoading = null;
          context.notify(`Could not load the ice-sheet maps: ${errorMessage(error)}`);
        },
      );
    }
    return iceIndex;
  }

  /**
   * While travelling through the Holocene: the ice sheets and the sea level of the year, over
   * today's Earth: the shelf the lower sea left bare, and the ice that still lay on the land.
   */
  function showHoloceneEarth(state: ViewState): void {
    if (!context.travelling() || state.mode !== 'globe') {
      holoceneSea = null;
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
      context.holoceneShown(state);
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
    context.holoceneShown(state);
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
  let seaIceIndex: SeaIceIndex | null = null;
  let seaIceLoading: Promise<SeaIceIndex> | null = null;

  /**
   * Sea ice blended from today's towards the chosen model's: on the ice-age scale, and in the
   * years (ma null) by the time of year, at the travelled year's sea level or else today's.
   */
  function showSeaIce(state: ViewState, ma: number | null): SeaIceView | null {
    if (ma !== null && state.deepScale !== 'ice') {
      globe.setSeaIce(null);
      return null;
    }
    if (seaIceIndex === null) {
      if (seaIceLoading === null) {
        seaIceLoading = loadSeaIce(`${base}data/seaice/index.json`, fetchJson);
        seaIceLoading.then(
          (index) => {
            seaIceIndex = index;
            context.redraw();
          },
          (error: unknown) => {
            seaIceLoading = null;
            context.notify(`Could not load the sea-ice maps: ${errorMessage(error)}`);
          },
        );
      }
      return { model: state.seaIce, mix: null };
    }
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
    return {
      coast: state.coast,
      seaLevel: coastline?.seaLevel ?? null,
      label: coastline?.series.label ?? null,
      instead: coastline?.instead?.label ?? null,
    };
  }

  return {
    bar: (state, ma) => ({
      coastline: showCoastline(ma, state),
      ice: showIce(state, ma),
      iceOutlines: showIceOutlines(state, ma),
      seaIce: showSeaIce(state, ma),
      seaLevel: seaLevelView(state),
    }),
    off(state) {
      showHoloceneEarth(state);
      iceOutlinesOnGlobe.update(null);
    },
    showHolocene: showHoloceneEarth,
    holoceneText: () => (holoceneSea === null ? null : earthText(holoceneSea)),
  };
}
