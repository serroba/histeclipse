/**
 * Named periods as a feature (#446, #909): in historical time with the layer on, the
 * archaeological and historical periods named for the place picked, said in the Layers panel.
 * The file loads the first time the layer is turned on.
 */

import { astronomicalYear, formatYear } from '../../time/year';
import {
  countryRings,
  loadNamedPeriods,
  periodsHere,
  periodsText,
  type NamedPeriods,
} from '../../data/namedPeriods';
import { errorMessage } from '../../util/errors';
import { feature } from '../feature';

export const periodsFeature = feature({
  id: 'periods',
  needs: [],
  // On or off with its layer, in historical time, for the place picked; the year is the moment's.
  watches: (state) => [state.layers, state.ma, state.location],
  mount(context) {
    let named: {
      readonly data: NamedPeriods;
      readonly rings: ReturnType<typeof countryRings>;
    } | null = null;
    let loading = false;
    let said: string | null = null;

    return {
      show(state) {
        const on = state.layers.has('periods') && state.ma === null;
        if (!on) {
          said = null;
          return;
        }
        if (named === null) {
          said = 'Loading the named periods…';
          if (loading) return;
          loading = true;
          loadNamedPeriods(`${context.base}data/periods.json`, context.fetchJson).then(
            (data) => {
              named = { data, rings: countryRings(data) };
              context.refresh();
            },
            (error: unknown) => {
              loading = false;
              context.notify(`Could not load the named periods: ${errorMessage(error)}`);
            },
          );
          return;
        }
        const year = state.time.date.year;
        const here =
          state.location === null
            ? null
            : periodsHere(named.data, named.rings, state.location, year);
        said = periodsText(here, formatYear(astronomicalYear(year)));
      },
      said: () => said,
    };
  },
});
