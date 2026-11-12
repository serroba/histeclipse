/**
 * The planets (#449): their theory, loaded with the sky view or when the space view zooms out
 * far enough or centres on one; their orbits around the Sun; where each is, and as an observer
 * sees it.
 */

import type { EquatorialVector } from '../../astro/moon';
import type { Vector3 } from '../../astro/matrix';
import {
  loadPlanetEphemeris,
  ORBIT_DAYS,
  ORBITING,
  orbitPath,
  PLANETS,
  type Orbiting,
  type PlanetEphemeris,
  type PlanetName,
} from '../../astro/planets';
import type { Globe } from '../../globe/scene';
import type { SkyPlanet } from '../../sky/skyScene';
import type { ViewState } from '../../state/viewState';
import type { JulianDay } from '../../time/julianDay';
import type { ZoomRail } from '../../ui/zoomRail';
import { elementAt } from '../../util/arrays';
import { seenPlanet } from './seen';

/** Earth radii (or the focused body's): beyond this the space view loads the planets. */
const PLANETS_SHOWN_BEYOND = 1000;

export interface Planets {
  /** The planets' theory, once loaded. */
  readonly theory: () => PlanetEphemeris | null;
  /** Whether it has been asked for. */
  readonly asked: () => boolean;
  readonly load: () => Promise<PlanetEphemeris>;
  /** Whether the space view is far enough out, or close to a planet, to need them. */
  readonly wanted: (state: ViewState) => boolean;
  /** With the layer on and the view far enough out, the orbits around the Sun. */
  readonly showOrbits: (state: ViewState, jdTT: number) => void;
  /** Each planet's place from Earth's centre, J2000 km, once the theory has loaded. */
  readonly positions: (
    jdTT: JulianDay,
  ) => Readonly<Record<PlanetName, readonly [number, number, number]>> | null;
  /** The planets as an observer sees them. */
  readonly seen: (jdTT: JulianDay, sun: Vector3, observer: Vector3) => SkyPlanet[];
}

export function createPlanets(context: {
  readonly base: string;
  readonly globe: Pick<Globe, 'setSaturnRings' | 'setOrbits'>;
  readonly zoomRail: Pick<ZoomRail, 'setOrbits'>;
  /** Show the moment again: the theory has loaded. */
  refresh(): void;
  /** The orbits were drawn, with the body in focus: the moons' are drawn with them. */
  orbitsDrawn(focus: string): void;
}): Planets {
  const { base, globe } = context;
  // The planets' theory loads with the sky view, or when the space view zooms out far enough to
  // show them, or centres on one.
  let planets: PlanetEphemeris | null = null;
  let planetsLoading: Promise<PlanetEphemeris> | null = null;
  function loadPlanets(): Promise<PlanetEphemeris> {
    planetsLoading ??= loadPlanetEphemeris().then((theory) => {
      planets = theory;
      // Saturn's rings as measured (#336): Voyager's optical depths, Cassini's colour.
      globe.setSaturnRings(`${base}textures/planets/saturn-rings.png`);
      context.refresh();
      return theory;
    });
    return planetsLoading;
  }

  /** Whether the space view is far enough out, or close to a planet, to need them. */
  function wantPlanets(state: ViewState): boolean {
    if (state.mode !== 'globe') return false;
    return state.focus !== 'earth' && state.focus !== 'moon'
      ? true
      : state.camera.distance > PLANETS_SHOWN_BEYOND;
  }

  // Each orbit as last drawn, and the day it was centred on: drawn again only once the body has
  // gone a quarter of the way round, as summing the series 128 times a body takes a while.
  let orbitCache: Partial<Record<Orbiting, { jdTT: number; path: readonly EquatorialVector[] }>> =
    {};
  let orbitsDrawn: string | null = null;
  /** With the layer on and the view far enough out, the orbits around the Sun. */
  function showOrbits(state: ViewState, jdTT: number): void {
    context.zoomRail.setOrbits(wantPlanets(state) && state.ma === null, state.layers.has('orbits'));
    const theory = planets;
    if (
      !state.layers.has('orbits') ||
      !wantPlanets(state) ||
      theory === null ||
      state.ma !== null
    ) {
      if (orbitsDrawn !== null) globe.setOrbits(null);
      orbitsDrawn = null;
      return;
    }
    let changed = orbitsDrawn === null;
    for (const body of ORBITING) {
      const cached = orbitCache[body];
      if (cached === undefined || Math.abs(jdTT - cached.jdTT) > ORBIT_DAYS[body] / 4) {
        orbitCache = { ...orbitCache, [body]: { jdTT, path: orbitPath(theory, body, jdTT) } };
        changed = true;
      }
    }
    if (!changed) return;
    orbitsDrawn = 'on';
    // The moons' orbits are drawn with the planets' (#335).
    context.orbitsDrawn(state.focus);
    globe.setOrbits(
      Object.fromEntries(ORBITING.map((body) => [body, orbitCache[body]?.path ?? []])) as Record<
        Orbiting,
        readonly EquatorialVector[]
      >,
    );
  }

  function planetPositions(
    jdTT: JulianDay,
  ): Readonly<Record<PlanetName, readonly [number, number, number]>> | null {
    if (planets === null) return null;
    const theory = planets;
    return Object.fromEntries(
      PLANETS.map((planet) => [planet, theory.position(planet, jdTT)]),
    ) as Record<PlanetName, readonly [number, number, number]>;
  }
  // Planets from Earth's centre for the moment last shown: turning the view or moving the
  // observer reuses them rather than summing the series again.
  let planetCache: { jdTT: number; fromEarth: readonly Vector3[] } | null = null;
  function planetsSeen(jdTT: JulianDay, sun: Vector3, observer: Vector3): SkyPlanet[] {
    if (planets === null) return [];
    const theory = planets;
    if (planetCache?.jdTT !== jdTT) {
      planetCache = { jdTT, fromEarth: PLANETS.map((planet) => theory.apparent(planet, jdTT)) };
    }
    const cached = planetCache.fromEarth;
    return PLANETS.map((planet, index) =>
      seenPlanet(planet, elementAt(cached, index), sun, observer),
    );
  }

  return {
    theory: () => planets,
    asked: () => planetsLoading !== null,
    load: loadPlanets,
    wanted: wantPlanets,
    showOrbits,
    positions: planetPositions,
    seen: planetsSeen,
  };
}
