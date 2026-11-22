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
import { feature } from '../feature';
import { loadOnce } from '../layerLoad';

export const periodsFeature = feature({
  id: 'periods',
  needs: [],
  // On or off with its layer, in historical time, for the place picked; the year is the moment's.
  watches: (state) => [state.layers, state.ma, state.location],
  mount(context) {
    const load = loadOnce<{
      readonly data: NamedPeriods;
      readonly rings: ReturnType<typeof countryRings>;
    }>({
      fetch: () =>
        loadNamedPeriods(`${context.base}data/periods.json`, context.fetchJson).then((data) => ({
          data,
          rings: countryRings(data),
        })),
      what: 'the named periods',
      context,
    });
    let on = false;
    let said: string | null = null;

    return {
      show(state) {
        on = state.layers.has('periods') && state.ma === null;
        if (!on) {
          said = null;
          return;
        }
        const named = load.value();
        if (named === null) {
          load.want();
          said =
            load.status() === 'failed'
              ? 'Could not load the named periods.'
              : 'Loading the named periods…';
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
      load: () => load.report(on),
    };
  },
});
