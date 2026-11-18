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
import { loadTelescopes } from '../../data/telescopes';
import { errorMessage } from '../../util/errors';
import type { Feature, FeatureContext } from '../feature';
import type { Geocentric } from './approximatePaths';
import { craftInFlight } from './craftLayer';
import { craftCards } from './craftPictures';
import { withGoTo, withModel } from './craftModels';
import { craftModel, focusedCraft, pointsBeside, seesModel } from './craftModelLayer';
import {
  craftNow,
  craftRoutes,
  craftWheres,
  remembered,
  type CraftRoute,
  type CraftWheres,
} from './craftNow';
import { easedOrbits, type Eased } from './orbitEase';
import { today } from './programs';
import { bodyOfWorld, landedOn, landingSites } from './landingSites';
import { missionRoutes } from './routeLines';

export { mountLaunches, type LaunchesContext, type LaunchesPart } from './launches';

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
  where: { readonly then: Geocentric; readonly now: Geocentric; readonly eased: Eased },
  mission: Mission | null,
  jdTT: number,
): { craft: ReturnType<typeof craftNow>; routes: readonly CraftRoute[] | null } {
  if (mission === null) {
    return {
      craft: craftNow(loaded.craft, loaded.wheres, where.then, jdTT, null, where.now, where.eased),
      routes: null,
    };
  }
  const followed = { from: mission.start, to: mission.end, aboutEarth: mission.aboutEarth };
  return {
    craft: craftNow(
      mission.craft,
      loaded.wheres,
      where.then,
      jdTT,
      followed,
      where.then,
      where.eased,
    ),
    routes: craftRoutes(mission.craft, loaded.wheres, where.then, jdTT, followed),
  };
}

/** From further off than this, in Earth's radii, a craft in Earth orbit sits on Earth. */
const CLOSE_ON_EARTH = 25;
/** Earth's radius at the equator, km. */
const EARTH_RADIUS_KM = 6378.137;
/**
 * A craft far out about Earth (Chandra, a third of the way to the Moon, #849) is clear of it from
 * further off: drawn while the camera is within this many times its own distance from Earth.
 */
const CLEAR_OF_EARTH = 12;

/** Whether a craft about Earth, `out` Earth radii from its centre, is drawn clear of it. */
function nearEnough(state: ViewState, out: number): boolean {
  if (closeOnEarth(state)) return true;
  return state.focus === 'earth' && state.camera.distance <= CLEAR_OF_EARTH * out;
}

/**
 * Whether Earth is close up: its orbiting craft can be told from it. On a craft about Earth
 * (#796), whose own few metres the distance is in, they are drawn too.
 */
function closeOnEarth(state: ViewState): boolean {
  return (
    state.focus === 'earth' && (state.craft !== null || state.camera.distance <= CLOSE_ON_EARTH)
  );
}

/**
 * Whether a craft is drawn in a view. Not at the centre of the body in view: close up, its
 * landers are marked on it (#716). Not in orbit about Earth unless Earth is close up (#795).
 */
function drawnIn(
  state: ViewState,
  craft: { readonly at: string | null; readonly ring?: true; readonly km: readonly number[] },
): boolean {
  if (craft.ring === true && !nearEnough(state, Math.hypot(...craft.km) / EARTH_RADIUS_KM)) {
    return false;
  }
  return craft.at === null || bodyOfWorld(craft.at) !== state.focus;
}

/**
 * The space telescopes' craft (#849), for the Telescopes layer: with it on and the Spacecraft
 * layer off, only these fly. `ids` is undefined with neither layer on, 'loading' while the
 * telescopes' record comes, else their GCAT ids.
 */
function telescopeCraft(context: FeatureContext): {
  ids(state: ViewState): ReadonlySet<string> | 'loading' | undefined;
} {
  let ids: ReadonlySet<string> | null = null;
  let asked = false;
  return {
    ids(state) {
      if (!state.layers.has('telescopes')) return undefined;
      if (ids !== null) return ids;
      if (!asked) {
        asked = true;
        loadTelescopes(`${context.base}data/telescopes.json`, context.fetchJson).then(
          (record) => {
            ids = new Set(
              record.telescopes.flatMap((telescope) =>
                telescope.kind === 'space' && telescope.craft !== null
                  ? [telescope.craft.toUpperCase()]
                  : [],
              ),
            );
            context.refresh();
          },
          (error: unknown) => {
            asked = false;
            context.notify(`Could not load the telescopes: ${errorMessage(error)}`);
          },
        );
      }
      return 'loading';
    },
  };
}

/** The record, its missions and where each craft is: loaded the first time the layer is on. */
interface Loaded {
  readonly craft: readonly Craft[];
  readonly missions: readonly Mission[];
  readonly wheres: CraftWheres;
}

/**
 * Asks for the record and the paths, once; again only after a failure. `done` has them, and the
 * moment is shown again.
 */
function loader(
  context: FeatureContext,
  then: Geocentric,
  done: (loaded: Loaded) => void,
): () => void {
  let asked = false;
  return () => {
    if (asked) return;
    asked = true;
    Promise.all([
      loadSpacecraft(`${context.base}data/spacecraft.json`, context.fetchJson),
      loadSpacecraftPaths(`${context.base}data/spacecraft-paths.json`, context.fetchJson),
    ]).then(
      ([record, paths]) => {
        done({
          craft: [...record.craft, ...record.aboutEarth],
          missions: missions(record.craft, today()),
          wheres: craftWheres(paths, then),
        });
        context.refresh();
      },
      (error: unknown) => {
        asked = false;
        context.notify(`Could not load the spacecraft: ${errorMessage(error)}`);
      },
    );
  };
}

/**
 * Draw the craft flying at `jdTT`: the mission followed, or every craft, or with `only`, just
 * those (the space telescopes, #849). Says which mission is followed and which craft is focused.
 */
function drawFlying(
  layers: {
    readonly drawn: ReturnType<typeof craftInFlight>;
    readonly routes: ReturnType<typeof missionRoutes>;
    readonly sites: ReturnType<typeof landingSites>;
    readonly model: ReturnType<typeof craftModel>;
  },
  loaded: Loaded,
  where: Parameters<typeof shownAt>[1],
  at: {
    readonly state: ViewState;
    readonly jdTT: number;
    readonly only: ReadonlySet<string> | null;
  },
): { readonly followed: string | null; readonly on: string | null } {
  const { state, jdTT, only } = at;
  const mission =
    state.mission === null || only !== null ? null : missionNamed(loaded.missions, state.mission);
  const shown = shownAt(loaded, where, mission, jdTT);
  // The craft the camera is on is drawn as its model, close up, not its point (#796).
  const focused = focusedCraft(state.craft, shown.craft);
  layers.model.update(focused);
  const inView = shown.craft.filter(
    (each) => drawnIn(state, each) && (only === null || only.has(each.id)),
  );
  layers.drawn.update(pointsBeside(focused, inView, state.camera.distance));
  layers.routes.update(only === null ? shown.routes : null);
  layers.sites.update(
    only === null
      ? { body: state.focus, sites: landedOn(mission?.craft ?? loaded.craft, state.focus, jdTT) }
      : null,
  );
  return { followed: mission?.id ?? null, on: focused === null ? null : state.craft };
}

export const spacecraftFeature: Feature = {
  id: 'spacecraft',
  picks: 'craft',
  // On or off with its layer; a mission followed, or every craft.
  // On a craft, whether it is close enough to be its model, not its point (#796).
  watches: (state) => [
    state.layers,
    state.mission,
    state.craft,
    seesModel(state.craft, state.camera.distance),
    closeOnEarth(state),
  ],
  mount(context) {
    const drawn = context.globe.addLayer(craftInFlight);
    const routes = context.globe.addLayer(missionRoutes);
    const sites = context.globe.addLayer(landingSites);
    const model = context.globe.addLayer(craftModel);
    // Kept from frame to frame: the trails ask for the same places as the time plays (#702).
    const where = {
      then: remembered(geocentric(context)),
      now: drawnNow(context),
      eased: easedOrbits(),
    };
    /** The mission followed, by its id, as last shown. */
    let followed: string | null = null;
    let loaded: Loaded | null = null;
    const load = loader(context, where.then, (all) => {
      loaded = all;
    });
    const telescopes = telescopeCraft(context);
    /** The craft the camera is on (#796), as last shown. */
    let on: string | null = null;
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
      const card = withGoTo(
        withModel(craftCard(craft, loaded.wheres.approximate(craft)), craft.id),
        craft.id,
        on,
        context,
      );
      const own = missionNamed(loaded.missions, craft.id);
      return own === null ? card : { ...card, related: follow(own) };
    });

    return {
      show(state, jdTT) {
        const offered = state.mode === 'globe' && state.ma === null;
        context.zoomRail.setSpacecraft(offered, state.layers.has('spacecraft'));
        // With only the Telescopes layer on, only the space telescopes fly (#849).
        const only = state.layers.has('spacecraft') ? null : telescopes.ids(state);
        if (!offered || only === undefined) {
          drawn.update(null);
          routes.update(null);
          sites.update(null);
          model.update(null);
          return;
        }
        if (context.ephemerides.planets() === null) void context.ephemerides.loadPlanets();
        if (loaded === null) {
          load();
          return;
        }
        if (only === 'loading') return;
        const flying = drawFlying({ drawn, routes, sites, model }, loaded, where, {
          state,
          jdTT,
          only,
        });
        followed = flying.followed;
        on = flying.on;
      },
      pick: open,
    };
  },
};
