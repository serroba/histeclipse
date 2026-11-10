/**
 * Every craft sent beyond Earth orbit (#350), the second feature on the contract (#380): the
 * record and Horizons's paths loaded the first time it is on, each craft's approximate path
 * worked out once, as it flies; each drawn where it was at the moment shown, named, a tap on a
 * name opening its card.
 */

import { PLANETS } from '../../astro/planets';
import { sunPositionJ2000 } from '../../astro/precession';
import { craftCard } from '../../data/craftCard';
import { loadSpacecraft, type Spacecraft } from '../../data/spacecraft';
import { loadSpacecraftPaths } from '../../data/spacecraftPaths';
import type { JulianDay } from '../../time/julianDay';
import { errorMessage } from '../../util/errors';
import type { Feature, FeatureContext } from '../feature';
import type { Geocentric } from './approximatePaths';
import { craftInFlight } from './craftLayer';
import { craftNow, craftWheres, type CraftWheres } from './craftNow';

/** Where the Sun, the Moon and the planets are from Earth's centre, for the craft. */
function geocentric(context: FeatureContext): Geocentric {
  return (body, jdTT) => {
    const jd = jdTT as JulianDay;
    if (body === 'Sun') return sunPositionJ2000(jd);
    if (body === 'Moon') return context.moon()?.position(jd) ?? null;
    const planet = PLANETS.find((name) => name === body.toLowerCase());
    return planet === undefined ? null : (context.planets()?.position(planet, jd) ?? null);
  };
}

export const spacecraftFeature: Feature = {
  id: 'spacecraft',
  picks: 'craft',
  // On or off with its layer.
  watches: (state) => [state.layers],
  mount(context) {
    const drawn = context.globe.addLayer(craftInFlight);
    const where = geocentric(context);
    let loaded: { readonly record: Spacecraft; readonly wheres: CraftWheres } | null = null;
    let asked = false;

    return {
      show(state, jdTT) {
        const offered = state.mode === 'globe' && state.ma === null;
        context.zoomRail.setSpacecraft(offered, state.layers.has('spacecraft'));
        if (!offered || !state.layers.has('spacecraft')) {
          drawn.update(null);
          return;
        }
        if (context.planets() === null) context.loadPlanets();
        if (loaded === null) {
          if (asked) return;
          asked = true;
          Promise.all([
            loadSpacecraft(`${context.base}data/spacecraft.json`, context.fetchJson),
            loadSpacecraftPaths(`${context.base}data/spacecraft-paths.json`, context.fetchJson),
          ]).then(
            ([record, paths]) => {
              loaded = { record, wheres: craftWheres(paths, where) };
              context.refresh();
            },
            (error: unknown) => {
              asked = false;
              context.notify(`Could not load the spacecraft: ${errorMessage(error)}`);
            },
          );
          return;
        }
        drawn.update(craftNow(loaded.record.craft, loaded.wheres, where, jdTT));
      },
      pick(id) {
        const craft = loaded?.record.craft.find((each) => each.id === id);
        if (craft !== undefined && loaded !== null) {
          context.showCard(craftCard(craft, loaded.wheres.approximate(craft)));
        }
      },
    };
  },
};
