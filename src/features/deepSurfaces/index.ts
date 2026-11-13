/**
 * Deep time's continents and air as a part of the page (#444): a second reconstruction's plates
 * outlined and how far they have moved, and the air's gases (the ice cores, the last 540 million
 * years, and the Paleo-CO2 Data Archive). Each loads the first time it is asked for. The
 * temperature maps are a layer of their own, in features/temperature.
 */

import type { Globe } from '../../globe/globe';
import type { PartContext } from '../part';
import type { ViewState } from '../../state/viewState';
import type { DeepTimeView } from '../../ui/deepTimeBar';
import { framesAround } from '../../data/paleoDem';
import { loadPlateMotion, motionText, type PlateMotion } from '../../data/plateMotion';
import { loadAtmosphere, type Atmosphere } from '../../data/atmosphere';
import { loadCo2Archive, type Co2Archive } from '../../data/co2Archive';
import { loadDeepAir, type DeepAir } from '../../data/deepAir';
import {
  loadPlateMasks,
  type PlateMaskIndex,
  platesBeyondText,
  plateText,
} from '../../data/plateMasks';
import { errorMessage } from '../../util/errors';

/** What deep time's climate and continents ask of the rest of the page. */
export interface DeepSurfacesContext extends PartContext {
  readonly globe: Pick<Globe, 'setPlates'>;
  /** Show deep time again: a map's index has arrived. */
  redraw(): void;
}

export interface DeepSurfacesPart {
  /** What deep time's bar says of them, drawing the plates for the moment `ma`. */
  readonly bar: (
    state: ViewState,
    ma: number,
  ) => Pick<DeepTimeView, 'plateMotion' | 'air' | 'plates' | 'platesText'>;
  /** How far back the plates reach, Ma, once their index has loaded. */
  readonly platesReach: () => number | undefined;
  /** Load the Paleo-CO2 Data Archive. */
  readonly loadArchive: () => void;
  /** Out of deep time: none of them drawn. */
  readonly off: () => void;
}

export function mountDeepSurfaces(context: DeepSurfacesContext): DeepSurfacesPart {
  const { base, fetchJson, globe } = context;
  let platesLoading: Promise<PlateMaskIndex> | null = null;
  let platesIndex: PlateMaskIndex | null = null;

  /** A second reconstruction's continents, outlined, while the layer is on. */
  function showPlates(
    state: ViewState,
    ma: number,
  ): { readonly plates: boolean; readonly platesText: string | null } {
    if (!state.layers.has('plates')) {
      globe.setPlates(null);
      return { plates: false, platesText: null };
    }
    if (platesIndex === null) {
      if (platesLoading === null) {
        platesLoading = loadPlateMasks(`${base}data/plates/index.json`, fetchJson);
        platesLoading.then(
          (index) => {
            platesIndex = index;
            context.redraw();
          },
          (error: unknown) => {
            platesLoading = null;
            context.notify(`Could not load the continent outlines: ${errorMessage(error)}`);
          },
        );
      }
      return { plates: true, platesText: null };
    }
    const reach = platesIndex.frames.at(-1)?.ma ?? 0;
    if (ma > reach) {
      globe.setPlates(null);
      return { plates: true, platesText: platesBeyondText(reach) };
    }
    const { younger, older, mix } = framesAround(platesIndex.frames, ma);
    globe.setPlates({
      younger: `${base}data/plates/${younger.file}`,
      older: `${base}data/plates/${older.file}`,
      mix,
      columns: platesIndex.columns,
      rows: platesIndex.rows,
      turnYounger: younger.turn ?? 0,
      turnOlder: older.turn ?? 0,
    });
    return { plates: true, platesText: plateText(mix < 0.5 ? younger : older) };
  }

  // The ice-core gases: loaded the first time the layer is turned on.
  let atmosphere: Atmosphere | null = null;
  let atmosphereLoading: Promise<Atmosphere> | null = null;

  // The gases of the last 540 million years: loaded the first time Air is on at that scale.
  let deepAir: DeepAir | null = null;
  let deepAirLoading: Promise<DeepAir> | null = null;

  function showAir(state: ViewState): DeepTimeView['air'] {
    if (state.deepScale === 'eons' || !state.layers.has('air')) return { on: false };
    if (state.deepScale === 'all') {
      if (deepAir === null && deepAirLoading === null) {
        deepAirLoading = loadDeepAir(`${base}data/air-deep.json`, fetchJson);
        deepAirLoading.then(
          (loaded) => {
            deepAir = loaded;
            context.redraw();
          },
          (error: unknown) => {
            deepAirLoading = null;
            context.notify(`Could not load the deep-time gases: ${errorMessage(error)}`);
          },
        );
      }
      return { on: true, atmosphere, deep: deepAir, archive: co2Archive };
    }
    if (atmosphere === null && atmosphereLoading === null) {
      atmosphereLoading = loadAtmosphere(`${base}data/atmosphere.json`, fetchJson);
      atmosphereLoading.then(
        (loaded) => {
          atmosphere = loaded;
          context.redraw();
        },
        (error: unknown) => {
          atmosphereLoading = null;
          context.notify(`Could not load the ice-core gases: ${errorMessage(error)}`);
        },
      );
    }
    return { on: true, atmosphere, deep: deepAir, archive: co2Archive };
  }

  // The Paleo-CO2 Data Archive: loaded the first time the reader picks its estimates.
  let co2Archive: Co2Archive | null = null;
  let co2ArchiveLoading: Promise<Co2Archive> | null = null;

  function loadArchive(): void {
    if (co2Archive !== null || co2ArchiveLoading !== null) return;
    co2ArchiveLoading = loadCo2Archive(`${base}data/air-co2-archive.json`, fetchJson);
    co2ArchiveLoading.then(
      (loaded) => {
        co2Archive = loaded;
        context.redraw();
      },
      (error: unknown) => {
        co2ArchiveLoading = null;
        context.notify(`Could not load the Paleo-CO₂ Data Archive: ${errorMessage(error)}`);
      },
    );
  }

  // How far the plates have moved: the file loads the first time the ice-age scale is shown.
  let plateMotion: PlateMotion | null = null;
  let plateMotionLoading: Promise<PlateMotion> | null = null;

  function plateMotionText(state: ViewState, ma: number): string | null {
    if (state.deepScale !== 'ice') return null;
    if (plateMotion === null) {
      if (plateMotionLoading === null) {
        plateMotionLoading = loadPlateMotion(`${base}data/plates-motion.json`, fetchJson);
        plateMotionLoading.then(
          (loaded) => {
            plateMotion = loaded;
            context.redraw();
          },
          (error: unknown) => {
            plateMotionLoading = null;
            context.notify(`Could not load how far the plates moved: ${errorMessage(error)}`);
          },
        );
      }
      return null;
    }
    return motionText(plateMotion, ma);
  }

  return {
    bar: (state, ma) => ({
      plateMotion: plateMotionText(state, ma),
      air: showAir(state),
      ...showPlates(state, ma),
    }),
    platesReach: () => platesIndex?.frames.at(-1)?.ma,
    loadArchive,
    off() {
      globe.setPlates(null);
    },
  };
}
