import type { PartContext } from '../part';
import { type ViewState } from '../../state/viewState';
import { astronomicalYear, formatYear } from '../../time/year';
import {
  countryRings,
  loadNamedPeriods,
  periodsHere,
  periodsText,
  type NamedPeriods,
} from '../../data/namedPeriods';
import { errorMessage } from '../../util/errors';

/** What it asks of the rest of the page. */
export interface PeriodsContext extends PartContext {
  /** Say it again in the Layers panel: what it says has changed. */
  refresh(): void;
}

export interface PeriodsPart {
  readonly show: (state: ViewState) => void;
  /** What the Layers panel says under the layer, if anything. */
  readonly said: () => string | null;
  /** The named periods: loaded, loading, or neither yet. */
  readonly loaded: () => NamedPeriods | null;
  readonly loading: () => Promise<NamedPeriods> | null;
}

export function mountPeriods(context: PeriodsContext): PeriodsPart {
  const { base, fetchJson, store } = context;
  // Named periods: their file loads the first time the layer is turned on.
  let namedPeriods: {
    readonly data: NamedPeriods;
    readonly rings: ReturnType<typeof countryRings>;
  } | null = null;
  let namedPeriodsLoading: Promise<NamedPeriods> | null = null;
  let periodsSaid: string | null = null;

  /** In historical time with the layer on, the periods named for the place picked. */
  function showPeriods(state: ViewState): void {
    const on = state.layers.has('periods') && state.ma === null;
    if (!on) {
      periodsSaid = null;
      return;
    }
    if (namedPeriods === null) {
      periodsSaid = 'Loading the named periods…';
      if (namedPeriodsLoading === null) {
        namedPeriodsLoading = loadNamedPeriods(`${base}data/periods.json`, fetchJson);
        namedPeriodsLoading.then(
          (data) => {
            namedPeriods = { data, rings: countryRings(data) };
            showPeriods(store.get());
            context.refresh();
          },
          (error: unknown) => {
            namedPeriodsLoading = null;
            context.notify(`Could not load the named periods: ${errorMessage(error)}`);
          },
        );
      }
      return;
    }
    const year = state.time.date.year;
    const here =
      state.location === null
        ? null
        : periodsHere(namedPeriods.data, namedPeriods.rings, state.location, year);
    periodsSaid = periodsText(here, formatYear(astronomicalYear(year)));
  }

  return {
    show: showPeriods,
    said: () => periodsSaid,
    loaded: () => namedPeriods?.data ?? null,
    loading: () => namedPeriodsLoading,
  };
}
