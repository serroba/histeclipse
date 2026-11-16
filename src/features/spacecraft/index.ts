/**
 * Every craft sent beyond Earth orbit (#350), the second feature on the contract (#380): the
 * record and Horizons's paths loaded the first time it is on, each craft's approximate path
 * worked out once, as it flies; each drawn where it was at the moment shown, named, a tap on a
 * name opening its card. With a mission named (#712), only its craft, each with its whole route,
 * a mission about Earth drawn about Earth as it was at each moment. Close up on a world, its
 * landers are marked where they came down, and craft at it are not drawn at its centre (#716).
 * A craft that stays about Earth (#795, Hubble) is drawn only with Earth close up: from further
 * off it would sit on Earth.
 */

import { PLANETS } from '../../astro/planets';
import { sunPositionJ2000 } from '../../astro/precession';
import { craftCard, writtenDate } from '../../data/craftCard';
import { fromACraft } from '../../explore/related';
import { loadSpacecraft, type Craft } from '../../data/spacecraft';
import { missionNamed, missions, missionView, type Mission } from '../../data/spacecraftMission';
import type { RelatedStep } from '../../ui/markerCard';
import { loadSpacecraftPaths } from '../../data/spacecraftPaths';
import type { ViewState } from '../../state/viewState';
import type { JulianDay } from '../../time/julianDay';
import { errorMessage } from '../../util/errors';
import type { Feature, FeatureContext } from '../feature';
import type { Geocentric } from './approximatePaths';
import { craftInFlight } from './craftLayer';
import { craftCards } from './craftPictures';
import {
  craftNow,
  craftRoutes,
  craftWheres,
  remembered,
  type CraftRoute,
  type CraftWheres,
} from './craftNow';
import { today } from './programs';
import { bodyOfWorld, landedOn, landingSites } from './landingSites';
import { missionRoutes } from './routeLines';

export { mountLaunches } from './launches';

/** Where the Sun, the Moon and the planets are from Earth's centre, for the craft. */
function geocentric(context: FeatureContext): Geocentric {
  return (body, jdTT) => {
    const jd = jdTT as JulianDay;
    if (body === 'Sun') return sunPositionJ2000(jd);
    if (body === 'Moon') return context.ephemerides.moon()?.position(jd) ?? null;
    const planet = PLANETS.find((name) => name === body.toLowerCase());
    return planet === undefined
      ? null
      : (context.ephemerides.planets()?.position(planet, jd) ?? null);
  };
}

/**
 * The bodies at the moment shown, as they are drawn (#783): the Moon and the planets on the
 * grids the scene draws them from, so the craft at them sit on them and no series is summed a
 * second time for the same moment.
 */
function drawnNow(context: FeatureContext): Geocentric {
  return (body, jdTT) => {
    const jd = jdTT as JulianDay;
    if (body === 'Sun') return sunPositionJ2000(jd);
    if (body === 'Moon') return context.ephemerides.moonAt(jd);
    const planet = PLANETS.find((name) => name === body.toLowerCase());
    return planet === undefined
      ? null
      : (context.ephemerides.planetPositions(jd)?.[planet] ?? null);
  };
}

/** What a moment shows: every craft in flight, or a mission's craft and their routes. */
function shownAt(
  loaded: { readonly craft: readonly Craft[]; readonly wheres: CraftWheres },
  where: { readonly then: Geocentric; readonly now: Geocentric },
  mission: Mission | null,
  jdTT: number,
): { craft: ReturnType<typeof craftNow>; routes: readonly CraftRoute[] | null } {
  if (mission === null) {
    return {
      craft: craftNow(loaded.craft, loaded.wheres, where.then, jdTT, null, where.now),
      routes: null,
    };
  }
  const followed = { from: mission.start, to: mission.end, aboutEarth: mission.aboutEarth };
  return {
    craft: craftNow(mission.craft, loaded.wheres, where.then, jdTT, followed),
    routes: craftRoutes(mission.craft, loaded.wheres, where.then, jdTT, followed),
  };
}

/** From further off than this, in Earth's radii, a craft in Earth orbit sits on Earth. */
const CLOSE_ON_EARTH = 25;

/** Whether Earth is close up: its orbiting craft can be told from it. */
function closeOnEarth(state: ViewState): boolean {
  return state.focus === 'earth' && state.camera.distance <= CLOSE_ON_EARTH;
}

/**
 * Whether a craft is drawn in a view. Not at the centre of the body in view: close up, its
 * landers are marked on it (#716). Not in orbit about Earth unless Earth is close up (#795).
 */
function drawnIn(
  state: ViewState,
  craft: { readonly at: string | null; readonly ring?: true },
): boolean {
  if (craft.ring === true && !closeOnEarth(state)) return false;
  return craft.at === null || bodyOfWorld(craft.at) !== state.focus;
}

export const spacecraftFeature: Feature = {
  id: 'spacecraft',
  picks: 'craft',
  // On or off with its layer; a mission followed, or every craft.
  watches: (state) => [state.layers, state.mission, closeOnEarth(state)],
  mount(context) {
    const drawn = context.globe.addLayer(craftInFlight);
    const routes = context.globe.addLayer(missionRoutes);
    const sites = context.globe.addLayer(landingSites);
    // Kept from frame to frame: the trails ask for the same places as the time plays (#702).
    const where = { then: remembered(geocentric(context)), now: drawnNow(context) };
    /** The mission followed, by its id, as last shown. */
    let followed: string | null = null;
    let loaded: {
      readonly craft: readonly Craft[];
      readonly missions: readonly Mission[];
      readonly wheres: CraftWheres;
    } | null = null;
    let asked = false;
    /** From a craft (#731): its mission's journey, unless that is the one followed. */
    function follow(own: Mission): RelatedStep[] {
      const start = own.craft[0]?.launch;
      if (start === undefined) return [];
      return fromACraft(own.title, own.id === followed, writtenDate(start)).map((step) => ({
        ...step,
        run: () => {
          context.openAnchor({ body: own.aboutEarth ? 'earth' : 'sun', view: missionView(own) });
        },
      }));
    }

    /** A craft's card (#350), a telescope's with its pictures once they have come (#798). */
    const open = craftCards(context, (id) => {
      const craft = loaded?.craft.find((each) => each.id === id);
      if (craft === undefined || loaded === null) return null;
      const card = craftCard(craft, loaded.wheres.approximate(craft));
      const own = missionNamed(loaded.missions, craft.id);
      return own === null ? card : { ...card, related: follow(own) };
    });

    return {
      show(state, jdTT) {
        const offered = state.mode === 'globe' && state.ma === null;
        context.zoomRail.setSpacecraft(offered, state.layers.has('spacecraft'));
        if (!offered || !state.layers.has('spacecraft')) {
          drawn.update(null);
          routes.update(null);
          sites.update(null);
          return;
        }
        if (context.ephemerides.planets() === null) void context.ephemerides.loadPlanets();
        if (loaded === null) {
          if (asked) return;
          asked = true;
          Promise.all([
            loadSpacecraft(`${context.base}data/spacecraft.json`, context.fetchJson),
            loadSpacecraftPaths(`${context.base}data/spacecraft-paths.json`, context.fetchJson),
          ]).then(
            ([record, paths]) => {
              loaded = {
                craft: [...record.craft, ...record.aboutEarth],
                missions: missions(record.craft, today()),
                wheres: craftWheres(paths, where.then),
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
        followed = mission?.id ?? null;
        const shown = shownAt(loaded, where, mission, jdTT);
        drawn.update(shown.craft.filter((each) => drawnIn(state, each)));
        routes.update(shown.routes);
        sites.update({
          body: state.focus,
          sites: landedOn(mission?.craft ?? loaded.craft, state.focus, jdTT),
        });
      },
      pick: open,
    };
  },
};
