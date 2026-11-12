/**
 * Timmermann & Friedrich's (2016) dispersal model, for the Humans feature: the scenario picked
 * shaded on the globe where it has people settled, and the share of its land settled then. Its
 * index and each scenario load the first time they are picked.
 */

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
  return `Shaded: where Timmermann & Friedrich’s (2016) model, ${model.name}, has people settled by then: ${String(Math.round(model.share * 100))}% of the land it ever reaches. One model’s view, not evidence; its data is CC BY-NC 4.0 (non-commercial).`;
}

export interface Dispersal {
  /** Shade `scenario` at `ma` (null shades nothing), and say how it stands. */
  show(scenario: DispersalScenario | null, ma: number): DispersalShown;
}

export function createDispersal(context: FeatureContext): Dispersal {
  let index: Promise<DispersalIndex> | null = null;
  /** Each scenario loaded: its arrival times and its name. */
  const grids = new Map<string, { readonly grid: ArrivalGrid; readonly name: string }>();
  const loading = new Set<string>();

  function load(scenario: DispersalScenario): void {
    if (loading.has(scenario)) return;
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
        context.refresh();
      })
      .catch((error: unknown) => {
        // The index too, should it have been what failed.
        index = null;
        loading.delete(scenario);
        context.notify(`Could not load the dispersal model: ${errorMessage(error)}`);
      });
  }

  return {
    show(scenario, ma) {
      const loaded = scenario === null || scenario === 'off' ? undefined : grids.get(scenario);
      if (scenario === null || scenario === 'off' || loaded === undefined) {
        context.globe.setSettled(null);
        if (scenario !== null && scenario !== 'off') load(scenario);
        return { scenario: scenario ?? 'off', name: null, share: null };
      }
      const ka = ma * 1000;
      context.globe.setSettled({ scenario, grid: loaded.grid, ka });
      return { scenario, name: loaded.name, share: settledShare(loaded.grid, ka) };
    },
  };
}
