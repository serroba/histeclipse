/**
 * Timmermann & Friedrich's (2016) dispersal model, for the Humans feature: the scenario picked
 * shaded on the globe where it has people settled, and the share of its land settled then. Its
 * index and each scenario load the first time they are picked.
 */

import type { LayerLoad } from '../../state/activeLayers';
import {
  loadDispersalIndex,
  settledShare,
  type ArrivalGrid,
  type DispersalIndex,
} from '../../data/dispersal';
import { loadArrivalGrid } from './arrivalGrid';
import type { DispersalScenario } from '../../state/viewState';
import { errorMessage } from '../../util/errors';
import type { FeatureContext } from '../feature';

/** The scenario shaded, its name once loaded, and the share of its land settled then. */
export interface DispersalShown {
  readonly scenario: DispersalScenario;
  readonly name: string | null;
  readonly share: number | null;
}

/** What the note says beside the picker. */
export function dispersalText(model: DispersalShown): string {
  if (model.scenario === 'off') {
    return 'Shade where a dispersal model has people settled by then (Timmermann & Friedrich 2016).';
  }
  if (model.share === null || model.name === null) return 'Loading the model…';
  return `Shaded: where Timmermann & Friedrich’s (2016) model, ${model.name}, has people settled by then: ${String(Math.round(model.share * 100))}% of the land it ever reaches, brightest where they arrived in the last 3,000 years. One model’s view, not evidence; its data is CC BY-NC 4.0 (non-commercial).`;
}

export interface Dispersal {
  /**
   * Shade `scenario` at `ma` (null shades nothing), and say how it stands; while time plays at
   * `maPerSecond`, in steps the map can be repainted at (#1045).
   */
  show(scenario: DispersalScenario | null, ma: number, maPerSecond?: number | null): DispersalShown;
  /** How its model loads while the layer is on, for the chip (#762). */
  report(on: boolean): LayerLoad | null;
}

/**
 * How often the shading is repainted while time plays (#1045): each repaint paints and uploads
 * the whole map, which a phone takes a tenth of a second or more to do.
 */
const REPAINTS_PER_SECOND = 4;

/**
 * The thousands of years to shade at: the moment itself when time stands, and while it plays, a
 * step of so many thousand years that the map is repainted about REPAINTS_PER_SECOND times a
 * second (the model's own step, a thousand years, at the slowest).
 */
export function shadedKa(ma: number, maPerSecond: number | null | undefined): number {
  const ka = ma * 1000;
  if (maPerSecond === null || maPerSecond === undefined || maPerSecond <= 0) return ka;
  const step = Math.max(1, Math.ceil((maPerSecond * 1000) / REPAINTS_PER_SECOND));
  return Math.round(ka / step) * step;
}

export function createDispersal(context: FeatureContext<'settledLand'>): Dispersal {
  let index: Promise<DispersalIndex> | null = null;
  /** Each scenario loaded: its arrival times and its name. */
  const grids = new Map<string, { readonly grid: ArrivalGrid; readonly name: string }>();
  const loading = new Set<string>();
  // A failed load waits for Try again from the chip, not asked for again each frame (#762).
  let failed = false;
  // The last share worked out: the grid is scanned again only when what is shaded changes.
  let lastShare: { readonly key: string; readonly share: number } | null = null;

  function load(scenario: DispersalScenario): void {
    if (failed || loading.has(scenario)) return;
    loading.add(scenario);
    index ??= loadDispersalIndex(`${context.base}data/dispersal/index.json`, context.fetchJson);
    index
      .then(async (loaded) => {
        const entry = loaded.scenarios.find((each) => each.id === scenario);
        if (entry === undefined) throw new Error(`no scenario ${scenario}`);
        const grid = await loadArrivalGrid(
          `${context.base}data/dispersal/${entry.file}`,
          context.fetchJson,
        );
        grids.set(scenario, { grid, name: entry.name });
        loading.delete(scenario);
        context.refresh();
      })
      .catch((error: unknown) => {
        // The index too, should it have been what failed.
        index = null;
        loading.delete(scenario);
        failed = true;
        context.notify(`Could not load the dispersal model: ${errorMessage(error)}`);
        context.refresh();
      });
  }

  return {
    report(on) {
      if (!on) return null;
      if (failed) {
        return {
          state: 'failed',
          retry: () => {
            failed = false;
            context.refresh();
          },
        };
      }
      return loading.size > 0 ? { state: 'loading' } : null;
    },
    show(scenario, ma, maPerSecond) {
      const loaded = scenario === null || scenario === 'off' ? undefined : grids.get(scenario);
      if (scenario === null || scenario === 'off' || loaded === undefined) {
        context.settledLand.setSettled(null);
        if (scenario !== null && scenario !== 'off') load(scenario);
        return { scenario: scenario ?? 'off', name: null, share: null };
      }
      const ka = shadedKa(ma, maPerSecond);
      context.settledLand.setSettled({ scenario, grid: loaded.grid, ka });
      const key = `${scenario} ${String(Math.round(ka))}`;
      if (lastShare?.key !== key)
        lastShare = { key, share: settledShare(loaded.grid, Math.round(ka)) };
      return { scenario, name: loaded.name, share: lastShare.share };
    },
  };
}
