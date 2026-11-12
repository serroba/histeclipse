/**
 * The other bodies as a part of the page (#449): the Sun, the Moon, the planets and their moons
 * up close, with the bar's line for the body in view and how it is shown; the planets' theory,
 * their orbits and the moons' orbits; the IAU's place names and the colour keys. Each loads the
 * first time it is needed.
 */

import { type MoonEphemeris } from '../../astro/moon';
import {
  loadMoonOrbits,
  moonPosition,
  type MoonName,
  type MoonOrbits,
} from '../../astro/moonOrbits';
import { PLANETS, type PlanetEphemeris, type PlanetName } from '../../astro/planets';
import type { Vector3 } from '../../astro/matrix';
import { sunPositionJ2000 } from '../../astro/precession';
import { sunDistance } from '../../astro/sun';
import {
  earthFromFacts,
  earthFromText,
  moonFacts,
  moonText,
  planetFacts,
  planetText,
  sunText,
} from '../../astro/bodyFacts';
import { loadColourKeys } from '../../data/planetKeys';
import { isNamedBody, loadPlaceNames, type PlaceNames } from '../../data/planetNames';
import { isMoonBody, MOON_MAPS, MOON_NAMES, MOON_VIEWS, moonPlanet } from '../../globe/moonLook';
import { moonNameLayer } from './moonNameLayer';
import { placeNameLayer } from './placeNameLayer';
import {
  PLANET_NAMES,
  PLANET_VIEWS,
  pickedView,
  planetView,
  type PlanetView,
} from '../../globe/planetLook';
import type { Globe } from '../../globe/scene';
import type { SkyPlanet } from '../../sky/skyScene';
import { ORBITS, redraws, SUN } from '../../state/redraws';
import type { ViewState } from '../../state/viewState';
import { moonAbout, moonLine } from '../../text/moonFacts';
import type { JulianDay } from '../../time/julianDay';
import { createBodyBar, type BodyKey } from './bodyBar';
import { createPlanetSwitch } from './planetSwitch';
import { lookBack } from '../../ui/viewSwitch';
import type { ZoomRail } from '../../ui/zoomRail';
import { errorMessage } from '../../util/errors';
import type { PartContext } from '../part';
import { createMoon } from './moon';
import { createPlanets } from './planets';
import { viewKey, type LoadedKeys } from './seen';
import { createSharpener, SHARP_WITHIN } from './sharpen';
import { createSunCloseUp } from './sun';

/** What the bodies ask of the rest of the page. */
export interface BodiesContext extends PartContext {
  readonly globe: Pick<
    Globe,
    | 'addLayer'
    | 'maxTextureSize'
    | 'setEarthTiles'
    | 'setBodyMap'
    | 'sharpenPlanet'
    | 'setMoonOrbits'
    | 'setMoonMap'
    | 'showMoonView'
    | 'showPlanetView'
    | 'setSunImage'
    | 'setSaturnRings'
    | 'setOrbits'
  >;
  readonly zoomRail: Pick<ZoomRail, 'setOrbits'>;
  /** The Moon's theory has arrived: show what needs it again. */
  moonArrived(): void;
  /** Show the moment again: the planets have loaded. */
  refresh(): void;
}

export interface BodiesPart {
  /** The bar's line for the body in view. */
  readonly bar: HTMLElement;
  /** How the Sun, and a planet or moon, are shown close up. */
  readonly switches: readonly HTMLElement[];
  /** The moment shown changed: `jdTT` in Terrestrial Time. */
  readonly setMoment: (jdTT: JulianDay) => void;
  /** The body in view and what can be said of it. */
  readonly show: (state: ViewState) => void;
  /** Close up, a sharper map for the body in focus. */
  readonly sharpen: (state: ViewState) => void;
  /** The planets when wanted, their orbits and the Sun close up, as the view changes. */
  readonly render: (state: ViewState, previous: ViewState | null) => void;
  /** With the layer on and the view far enough out, the orbits around the Sun. */
  readonly showOrbits: (state: ViewState, jdTT: number) => void;
  /** The planets' theory, once loaded. */
  readonly planets: () => PlanetEphemeris | null;
  readonly loadPlanets: () => Promise<PlanetEphemeris>;
  /** Each planet's place from Earth's centre, J2000 km, once the theory has loaded. */
  readonly planetPositions: (
    jdTT: JulianDay,
  ) => Readonly<Record<PlanetName, readonly [number, number, number]>> | null;
  /** The planets as an observer sees them. */
  readonly planetsSeen: (jdTT: JulianDay, sun: Vector3, observer: Vector3) => SkyPlanet[];
  /** The Moon's ephemeris, once loaded. */
  readonly moon: () => MoonEphemeris | null;
  /** Load the Moon's theory: once the page is up, as it is a chunk of its own. */
  readonly loadMoon: () => void;
}

export function mountBodies(context: BodiesContext): BodiesPart {
  const { base, fetchJson, store, globe } = context;
  // The moment last shown, in Terrestrial Time.
  let moment: JulianDay | null = null;
  // Away from Earth, the bar's line for the body in view, in place of Earth's own.
  // A planet's moon in view has its own sources (#335).
  const bodyBar = createBodyBar(
    context.why(
      () => (isMoonBody(store.get().focus) ? 'moons' : 'bodies'),
      'Sun, Moon and planets',
    ),
  );
  // How a planet is shown close up (#239), where it has more than one way.
  const planetSwitch = createPlanetSwitch((planetLight) => {
    store.set((state) => ({ ...state, planetLight }));
  });
  const sun = createSunCloseUp(context);
  const theMoon = createMoon(context);
  const planets = createPlanets({
    base,
    globe,
    zoomRail: context.zoomRail,
    refresh: () => {
      context.refresh();
    },
    orbitsDrawn: (focus) => {
      showMoons(focus, true);
    },
  });
  const placeNamesOnGlobe = globe.addLayer(placeNameLayer);
  const moonNamesOnGlobe = globe.addLayer(moonNameLayer);
  /** Earth looked back at from afar, as two missions photographed it. */
  const LOOKED_BACK =
    'So Voyager 1 saw it in 1990, from beyond Neptune: the “Pale Blue Dot” (NASA/JPL, PIA00452); and Cassini from Saturn in 2013, “The Day the Earth Smiled” (NASA/JPL-Caltech/SSI, PIA17171).';

  const sharpenClose = createSharpener(context);

  // The moons of Mars, Jupiter and Saturn (#335), loaded the first time one of them is in view.
  let moonOrbitsAsked = false;
  let moonOrbits: MoonOrbits | null = null;
  /** Load the moons' orbits once a planet with moons is in view, or the orbits are drawn. */
  function showMoons(body: string, orbitsShown = false): void {
    const near = body === 'mars' || body === 'jupiter' || body === 'saturn' || isMoonBody(body);
    if (moonOrbitsAsked || !(near || orbitsShown)) return;
    moonOrbitsAsked = true;
    loadMoonOrbits(`${base}data/moon-orbits.json`, fetchJson).then(
      (orbits) => {
        moonOrbits = orbits;
        globe.setMoonOrbits(orbits);
        moonNamesOnGlobe.update(true);
        show(store.get());
      },
      (error: unknown) => {
        moonOrbitsAsked = false;
        context.notify(`Could not load the moons’ orbits: ${errorMessage(error)}`);
      },
    );
  }

  // The IAU's place names on the rocky bodies (#334), loaded the first time one is in view.
  let placeNames: PlaceNames | null = null;
  let placeNamesAsked = false;
  /** Name the features of the body in view, if it has names; take away any others. */
  function showPlaceNames(body: string | null): void {
    const named = body !== null && isNamedBody(body) ? body : null;
    if (named !== null && placeNames === null && !placeNamesAsked) {
      placeNamesAsked = true;
      loadPlaceNames(`${base}data/planet-names.json`, fetchJson).then(
        (loaded) => {
          placeNames = loaded;
          show(store.get());
        },
        (error: unknown) => {
          placeNamesAsked = false;
          context.notify(`Could not load the place names: ${errorMessage(error)}`);
        },
      );
    }
    placeNamesOnGlobe.update(
      named !== null && placeNames !== null ? { body: named, names: placeNames[named] } : null,
    );
  }

  // The colour keys (#334): the height views', and the enhanced-colour views' swatches,
  // loaded the first time one shows.
  let colourKeys: LoadedKeys | null = null;
  let colourKeysAsked = false;
  /** A view's colour key for the bar, if it has one and the keys are in; else nothing. */
  function keyFor(view: PlanetView): { key?: BodyKey } {
    if (view.colourKey === undefined && view.rockKey === undefined) return {};
    if (colourKeys === null) {
      if (!colourKeysAsked) {
        colourKeysAsked = true;
        loadColourKeys(`${base}data/planet-keys.json`, fetchJson).then(
          (loaded) => {
            colourKeys = loaded;
            show(store.get());
          },
          (error: unknown) => {
            colourKeysAsked = false;
            context.notify(`Could not load the colour keys: ${errorMessage(error)}`);
          },
        );
      }
      return {};
    }
    return viewKey(colourKeys, view);
  }

  /** Away from Earth, the body in view and what can be said of it. */
  function show(state: ViewState): void {
    // As `awayFromEarth`, spelled out so the focus is known not to be Earth below.
    const away = state.mode === 'globe' && state.focus !== 'earth' && state.ma === null;
    if (away) showMoons(state.focus);
    // Not while standing on a planet looking back at Earth, nor on Venus's clouds, which hide
    // the ground the names are for.
    showPlaceNames(
      away &&
        (state.view !== 'earth-from-here' || state.focus === 'moon') &&
        (state.focus !== 'venus' || state.planetLight === 'radar')
        ? state.focus
        : null,
    );
    // The Light switch, for a planet or the Moon in view with more than one way to show it.
    const planet = state.focus === 'moon' ? 'moon' : PLANETS.find((name) => name === state.focus);
    const views =
      planet !== undefined
        ? PLANET_VIEWS[planet]
        : isMoonBody(state.focus)
          ? MOON_VIEWS[state.focus]
          : undefined;
    if (away && (state.view !== 'earth-from-here' || planet === 'moon') && views !== undefined) {
      planetSwitch.render(views, pickedView(views, state.planetLight).key);
    } else {
      planetSwitch.render(null, '');
    }
    if (!away || moment === null) {
      bodyBar.render(null);
      return;
    }
    const jdTT = moment;
    const sunKm = sunPositionJ2000(jdTT);
    const focus = state.focus;
    if (state.view === 'earth-from-here' && focus !== 'moon') {
      // Standing on the body in focus, looking back at Earth (#245).
      const observer =
        focus === 'sun'
          ? sunKm
          : isMoonBody(focus)
            ? moonFromEarth(focus, jdTT)
            : (planets.theory()?.position(focus, jdTT) ?? null);
      const [, label] = lookBack(focus);
      bodyBar.render(
        observer === null
          ? null
          : {
              name: label.replace('Earth from', 'Earth, seen from'),
              text: earthFromText(earthFromFacts(observer, sunKm)),
              picture: LOOKED_BACK,
            },
      );
    } else if (focus === 'sun') {
      bodyBar.render({ name: 'The Sun', text: sunText(sunDistance(jdTT)) });
    } else if (isMoonBody(focus)) {
      const at = moonFromEarth(focus, jdTT);
      // Its mission map, the sharper one close up (#335), or the view picked, for a moon seen
      // by more than one light; a view with no map is its painted colour.
      const views = MOON_VIEWS[focus];
      const look = views === undefined ? MOON_MAPS[focus] : pickedView(views, state.planetLight);
      if (look !== undefined) {
        const sharp = state.camera.distance <= SHARP_WITHIN ? look.sharp : null;
        const url = sharp ?? look.map;
        globe.setMoonMap(focus, url === null ? null : `${base}${url}`);
      }
      bodyBar.render(
        at === null || moonOrbits === null
          ? null
          : {
              name: MOON_NAMES[focus],
              text: moonLine(focus, moonOrbits[focus], Math.hypot(...at)),
              about: moonAbout(focus),
              ...(look === undefined ? {} : { picture: look.caption }),
            },
      );
    } else if (focus === 'moon') {
      const moonKm = theMoon.ephemeris()?.position(jdTT) ?? null;
      // The view picked (#239): the usual map, or a mission's other one, fetched the first time.
      const view = planetView('moon', state.planetLight);
      const { map, sharp, caption } = view;
      globe.showMoonView(
        map === null
          ? null
          : { map: `${base}${map}`, sharp: sharp === null ? null : `${base}${sharp}` },
      );
      bodyBar.render(
        moonKm === null
          ? null
          : {
              name: 'The Moon',
              text: moonText(moonFacts(moonKm, sunKm)),
              picture: caption,
              ...keyFor(view),
            },
      );
    } else {
      // The view picked (#239): a mission's map, fetched the first time, or the painted colours.
      const view = planetView(focus, state.planetLight);
      const { map, sharp, caption } = view;
      globe.showPlanetView(
        focus,
        map === null
          ? null
          : { map: `${base}${map}`, sharp: sharp === null ? null : `${base}${sharp}` },
      );
      const position = planets.theory()?.position(focus, jdTT);
      bodyBar.render(
        position === undefined
          ? null
          : {
              name: PLANET_NAMES[focus],
              text: planetText(planetFacts(focus, position, sunKm)),
              // Of the planets drawn, the inner two alone have no moons (#335).
              ...(focus === 'mercury' || focus === 'venus'
                ? { about: `${PLANET_NAMES[focus]} has no moons.` }
                : {}),
              picture: caption,
              ...keyFor(view),
            },
      );
    }
  }

  /** Where a planet's moon is from Earth's centre, J2000 km; null until both are known. */
  function moonFromEarth(moon: MoonName, jdTT: JulianDay): [number, number, number] | null {
    const planet = planets.theory()?.position(moonPlanet(moon), jdTT);
    if (planet === undefined || moonOrbits === null) return null;
    const [x, y, z] = moonPosition(moonOrbits[moon], jdTT);
    return [planet[0] + x, planet[1] + y, planet[2] + z];
  }

  return {
    bar: bodyBar.root,
    switches: [sun.switch, planetSwitch.root],
    setMoment: (jdTT) => {
      moment = jdTT;
    },
    show,
    sharpen: sharpenClose,
    render(state, previous) {
      // Asked once: a failed load is reported once rather than on every move of the camera.
      if (!planets.asked() && planets.wanted(state)) {
        planets.load().catch((error: unknown) => {
          context.notify(`Could not load the planets' orbits: ${errorMessage(error)}`);
        });
      }
      // The orbits come and go as the view moves out and in, or turns to the Sun or a planet.
      if (moment !== null && redraws(ORBITS, state, previous)) planets.showOrbits(state, moment);
      if (redraws(SUN, state, previous)) sun.show(state);
    },
    showOrbits: planets.showOrbits,
    planets: planets.theory,
    loadPlanets: planets.load,
    planetPositions: planets.positions,
    planetsSeen: planets.seen,
    moon: theMoon.ephemeris,
    loadMoon: theMoon.load,
  };
}
