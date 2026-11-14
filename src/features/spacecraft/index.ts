/**
 * Every craft sent beyond Earth orbit (#350), the second feature on the contract (#380): the
 * record and Horizons's paths loaded the first time it is on, each craft's approximate path
 * worked out once, as it flies; each drawn where it was at the moment shown, named, a tap on a
 * name opening its card. With a mission named (#712), only its craft, each with its whole route,
 * a mission about Earth drawn about Earth as it was at each moment.
 */

import { PLANETS } from '../../astro/planets';
import { sunPositionJ2000 } from '../../astro/precession';
import { craftCard } from '../../data/craftCard';
import { loadSpacecraft, type Craft } from '../../data/spacecraft';
import { missionNamed, missions, type Mission } from '../../data/spacecraftMission';
import { loadSpacecraftPaths } from '../../data/spacecraftPaths';
import type { JulianDay } from '../../time/julianDay';
import { errorMessage } from '../../util/errors';
import type { Feature, FeatureContext } from '../feature';
import type { Geocentric } from './approximatePaths';
import { craftInFlight } from './craftLayer';
import {
  craftNow,
  craftRoutes,
  craftWheres,
  remembered,
  type CraftRoute,
  type CraftWheres,
} from './craftNow';
import { today } from './programs';
import { missionRoutes } from './routeLines';

export { mountLaunches } from './launches';

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

/** What a moment shows: every craft in flight, or a mission's craft and their routes. */
function shownAt(
  loaded: { readonly craft: readonly Craft[]; readonly wheres: CraftWheres },
  where: Geocentric,
  mission: Mission | null,
  jdTT: number,
): { craft: ReturnType<typeof craftNow>; routes: readonly CraftRoute[] | null } {
  if (mission === null) {
    return { craft: craftNow(loaded.craft, loaded.wheres, where, jdTT), routes: null };
  }
  const followed = { from: mission.start, to: mission.end, aboutEarth: mission.aboutEarth };
  return {
    craft: craftNow(mission.craft, loaded.wheres, where, jdTT, followed),
    routes: craftRoutes(mission.craft, loaded.wheres, where, jdTT, followed),
  };
}

export const spacecraftFeature: Feature = {
  id: 'spacecraft',
  picks: 'craft',
  // On or off with its layer; a mission followed, or every craft.
  watches: (state) => [state.layers, state.mission],
  mount(context) {
    const drawn = context.globe.addLayer(craftInFlight);
    const routes = context.globe.addLayer(missionRoutes);
    // Kept from frame to frame: the trails ask for the same places as the time plays (#702).
    const where = remembered(geocentric(context));
    let loaded: {
      readonly craft: readonly Craft[];
      readonly missions: readonly Mission[];
      readonly wheres: CraftWheres;
    } | null = null;
    let asked = false;

    return {
      show(state, jdTT) {
        const offered = state.mode === 'globe' && state.ma === null;
        context.zoomRail.setSpacecraft(offered, state.layers.has('spacecraft'));
        if (!offered || !state.layers.has('spacecraft')) {
          drawn.update(null);
          routes.update(null);
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
              loaded = {
                craft: record.craft,
                missions: missions(record.craft, today()),
                wheres: craftWheres(paths, where),
              };
              context.refresh();
            },
            (error: unknown) => {
              asked = false;
              context.notify(`Could not load the spacecraft: ${errorMessage(error)}`);
            },
          );
          return;
        }
        const mission =
          state.mission === null ? null : missionNamed(loaded.missions, state.mission);
        const shown = shownAt(loaded, where, mission, jdTT);
        drawn.update(shown.craft);
        routes.update(shown.routes);
      },
      pick(id) {
        const craft = loaded?.craft.find((each) => each.id === id);
        if (craft !== undefined && loaded !== null) {
          context.showCard(craftCard(craft, loaded.wheres.approximate(craft)));
        }
      },
    };
  },
};
