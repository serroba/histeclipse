/**
 * Wires the view state (from the URL) to the globe, the timeline, the scrubber and the card.
 *
 * Browser-only glue, covered by the Playwright suite. Logic worth unit testing lives in the
 * modules it calls.
 */

import { loadMoonEphemeris, type MoonEphemeris } from './astro/moon';
import { loadSky } from './data/sky';
import { earthFixedToJ2000, sunPositionJ2000 } from './astro/precession';
import { subsolarPoint } from './astro/sun';
import { greatestEclipseUT, yearOf } from './data/catalog';
import {
  famousDate,
  famousFor,
  loadFamousEclipses,
  type FamousEclipse,
} from './data/famousEclipses';
import { LunarCatalog } from './data/lunarCatalog';
import { SolarCatalog, type SolarEclipse } from './data/solarCatalog';
import {
  eclipseMoment,
  eclipseSelection,
  findSelected,
  isSolar,
  momentAt,
} from './eclipses/describe';
import { lunarPhaseAt, SUBLUNAR_DRIFT_DEGREES_PER_HOUR } from './eclipses/lunarPhases';
import { shadowAt } from './eclipses/solar';
import { longitudeUncertainty, shiftLongitude } from './eclipses/visibility';
import { geoToVector } from './globe/geo';
import { createGlobe } from './globe/scene';
import { createStore } from './state/store';
import { parseViewState } from './state/url';
import { browserUrlWriter, createUrlSync } from './state/urlSync';
import {
  DEFAULT_CAMERA,
  defaultViewState,
  MA_RANGE,
  momentJulianDay,
  type GeoPoint,
  type ViewState,
} from './state/viewState';
import { eclipseNote, planetNote, skyCaption } from './sky/caption';
import {
  loadPlanetEphemeris,
  planetMagnitude,
  PLANETS,
  saturnRingTilt,
  type PlanetEphemeris,
  type PlanetName,
} from './astro/planets';
import type { SkyPlanet } from './sky/skyScene';
import { moonSunlight, observerPosition, sunVisible, topocentric } from './sky/bodies';
import { earthVelocity, horizonMatrix, horizontalOf } from './sky/horizon';
import { LOWEST_LOOK, roundLook } from './sky/look';
import { longTermEarthFixedToJ2000 } from './astro/longTermPrecession';
import type { Vector3 } from './astro/matrix';
import type { SkyScene } from './sky/skyScene';
import { DeltaT } from './time/deltaT';
import { formatCalendar, formatDate, formatDuration, formatTimeOfDay } from './time/format';
import { julianDayNumber, type JulianDay } from './time/julianDay';
import { formatInCalendar, yearContaining, yearSpan } from './time/calendars';
import { astronomicalYear, formatYear, type AstronomicalYear } from './time/year';
import { moveToYear } from './time/yearInput';
import { element } from './ui/dom';
import { createEclipseCard } from './ui/eclipseCard';
import { createFamousPanel } from './ui/famousPanel';
import { createScrubber, SCRUB_RANGE_MINUTES } from './ui/scrubber';
import { createAimSwitch, type AimTarget } from './ui/aimSwitch';
import { createSunSwitch } from './ui/sunSwitch';
import { createLayerSwitch } from './ui/layerSwitch';
import {
  centuryFor,
  labelPoint,
  loadEmpireCentury,
  loadEmpireIndex,
  territoriesIn,
  type EmpireCentury,
  type EmpireIndex,
  type Territory,
} from './data/empires';
import { createEmpireEclipses, SEARCH_YEARS } from './eclipses/empireEclipses';
import {
  loadOhmCentury,
  loadOhmIndex,
  ohmIn,
  type OhmCentury,
  type OhmIndex,
} from './data/ohmBorders';
import { createCultureSwitch } from './ui/cultureSwitch';
import {
  CULTURE_INFO,
  cultureFigures,
  loadCultureIndex,
  loadHipStars,
  withFigureStars,
  type SkyCulture,
} from './data/skyCultures';
import type { Figure } from './sky/look';
import { loadSunImages, type SunImages } from './data/sunImages';
import { createFigureSwitch } from './ui/figureSwitch';
import { createViewSwitch } from './ui/viewSwitch';
import { createDeepTimeBar } from './ui/deepTimeBar';
import { formatMa, periodAt } from './deepTime/periods';
import { framesAround, loadPaleoDemIndex, oldestMa, type PaleoDemIndex } from './data/paleoDem';
import { createTimeline, type Eclipse, type SeenView, type YearEclipses } from './ui/timeline';
import { elementAt } from './util/arrays';
import { errorMessage } from './util/errors';

const MINUTES_PER_DAY = 1440;
/** Field of view (degrees) when turning to the Sun or Moon: close enough to see the disc. */
const AIM_FOV = 12;
/** Earth radii (or the focused body's): beyond this the space view loads the planets. */
const PLANETS_SHOWN_BEYOND = 1000;
/** Deep time plays at this many million years per second: 540 Myr in about half a minute. */
const PLAY_MA_PER_SECOND = 20;
/** Where deep time opens: Pangaea, at the start of the Triassic. */
const DEEP_TIME_START_MA = 250;

export async function startApp(root: HTMLElement): Promise<void> {
  const base = import.meta.env.BASE_URL;
  const now = new Date();
  const parsed = parseViewState(window.location.search, now);
  const store = createStore<ViewState>(parsed.state);

  // Picking an eclipse also turns the globe toward it (or toward a famous eclipse's place);
  // opening a shared link does not, because the link already says where the camera should be.
  let flyToSelection = false;
  let flyTarget: GeoPoint | null = null;
  let famous: readonly FamousEclipse[] = [];
  const famousPanel = createFamousPanel((entry) => {
    void goToFamous(entry);
  });

  const viewSwitch = createViewSwitch((choice) => {
    if (choice === 'sky') {
      // Stand where the link says, or else on the spot in the middle of the globe; during an
      // eclipse, face it.
      store.set((state) => {
        // The sky is drawn for historical time: leaving for it leaves deep time too.
        const next: ViewState = { ...state, mode: 'sky', location: observerOf(state), ma: null };
        const selected = selectedEclipse(state);
        if (selected === undefined) return next;
        const look = aimAt(next, isSolar(selected) ? 'sun' : 'moon');
        return look === null || look.altitude <= -1 ? next : { ...next, look };
      });
    } else {
      store.set((state) => ({ ...state, mode: 'globe', view: choice }));
    }
  });
  const cultureSwitch = createCultureSwitch(base, (culture) => {
    // See the sky from where that culture watched it; the date stays as it is.
    const place = CULTURE_INFO[culture].place;
    store.set((state) => ({
      ...state,
      culture,
      location:
        place === null ? state.location : { latitude: place.latitude, longitude: place.longitude },
    }));
  });
  const figureSwitch = createFigureSwitch((figures) => {
    store.set((state) => ({ ...state, figures }));
  });
  const layerSwitch = createLayerSwitch(
    (on) => {
      store.set((state) => {
        const layers = new Set(state.layers);
        if (on) layers.add('empires');
        else layers.delete('empires');
        return { ...state, layers };
      });
    },
    (borders) => {
      store.set((state) => ({ ...state, borders }));
    },
  );
  const empireCredit = element(
    'span',
    { class: 'empire-credit', hidden: '' },
    ' · Borders: ',
    element(
      'a',
      { href: 'https://github.com/Seshat-Global-History-Databank/cliopatria' },
      'Cliopatria',
    ),
    ' (Seshat, ',
    element('a', { href: 'https://creativecommons.org/licenses/by/4.0/' }, 'CC BY 4.0'),
    ', simplified)',
  );
  const ohmCredit = element(
    'span',
    { class: 'empire-credit', hidden: '' },
    ' · Borders: © ',
    element('a', { href: 'https://www.openhistoricalmap.org/copyright' }, 'OpenHistoricalMap'),
    ' contributors (CC0, simplified)',
  );
  const paleoCredit = element(
    'span',
    { class: 'empire-credit', hidden: '' },
    ' · Surface: ',
    element('a', { href: 'https://doi.org/10.5281/zenodo.5460860' }, 'PALEOMAP PaleoDEMs'),
    ' (Scotese & Wright 2018, ',
    element('a', { href: 'https://creativecommons.org/licenses/by/4.0/' }, 'CC BY 4.0'),
    ', repacked) · Periods: ',
    element('a', { href: 'https://stratigraphy.org/chart' }, 'ICS chart v2026/06'),
  );
  const deepButton = element(
    'button',
    { type: 'button', class: 'deep-open', 'aria-pressed': 'false' },
    'Deep time',
  );
  deepButton.addEventListener('click', () => {
    if (store.get().ma === null) {
      // Deep time shows the whole Earth: the globe, with no eclipse picked.
      store.set((state) => ({
        ...state,
        ma: DEEP_TIME_START_MA,
        mode: 'globe',
        view: 'free',
        selection: null,
      }));
    } else {
      stopPlay();
      store.set((state) => ({ ...state, ma: null }));
    }
  });
  const deepBar = createDeepTimeBar({
    onMa(ma) {
      stopPlay();
      store.set((state) => ({ ...state, ma: Math.round(ma * 10) / 10 }));
    },
    onPlay(play) {
      if (play) startPlay();
      else stopPlay();
    },
    onExit() {
      stopPlay();
      store.set((state) => ({ ...state, ma: null }));
    },
  });
  const sunSwitch = createSunSwitch((sunLayer) => {
    store.set((state) => ({ ...state, sunLayer }));
  });
  const aimSwitch = createAimSwitch((target) => {
    store.set((state) => {
      const look = aimAt(state, target);
      return look === null ? state : { ...state, look };
    });
  });
  const globeContainer = element('div', { class: 'globe', 'data-testid': 'globe' });
  const skyContainer = element('div', { class: 'sky', 'data-testid': 'sky', hidden: '' });
  const skyText = element('p', { class: 'sky-caption' });
  const skyEclipse = element('p', { class: 'sky-eclipse', 'data-testid': 'sky-eclipse' });
  const dateText = element('time', { class: 'hud-date' });
  const timeText = element('span', { class: 'hud-time' });
  const detailText = element('p', { class: 'hud-detail' });
  const notices = element('ul', { class: 'notices', role: 'status', 'aria-live': 'polite' });
  const card = createEclipseCard();
  const timeline = createTimeline({
    onYear(year) {
      store.set((state) => ({ ...state, time: timeInYear(state, year), selection: null }));
    },
    onCalendar(years) {
      store.set((state) => ({ ...state, years }));
    },
    onSelect(eclipse) {
      flyToSelection = true;
      store.set((state) => ({
        ...state,
        time: eclipseMoment(eclipse),
        selection: eclipseSelection(eclipse),
      }));
    },
    onSeenIn(seenIn) {
      store.set((state) => ({ ...state, seenIn }));
      if (seenIn === null || store.get().mode !== 'globe') return;
      // Turn the globe to the state picked.
      territoryOf(seenIn, store.get().time.date.year).then(
        (territory) => {
          if (territory !== null) globe.flyTo(labelPoint(territory));
        },
        () => undefined, // The bar reports load errors.
      );
    },
    onSeenStep(direction) {
      stepSeen(direction);
    },
  });
  const scrubber = createScrubber((offsetMinutes) => {
    const selected = selectedEclipse(store.get());
    if (selected === undefined) return;
    const jd = greatestEclipseUT(selected) + offsetMinutes / MINUTES_PER_DAY;
    store.set((state) => ({ ...state, time: momentAt(julianDayNumber(jd)) }));
  });

  const bottom = element(
    'div',
    { class: 'bottom', 'data-deep': 'off' },
    card.root,
    scrubber.root,
    timeline.root,
    deepBar.root,
  );
  root.replaceChildren(
    globeContainer,
    skyContainer,
    element(
      'header',
      { class: 'hud' },
      element('h1', {}, 'histeclipse'),
      element('p', { class: 'hud-when' }, dateText, ' ', timeText),
      detailText,
      element('div', { class: 'hud-actions' }, famousPanel.button, deepButton, layerSwitch.root),
      viewSwitch.root,
      aimSwitch.root,
      figureSwitch.root,
      cultureSwitch.root,
      sunSwitch.root,
      skyText,
      skyEclipse,
      element(
        'p',
        { class: 'credits' },
        'Earth: ',
        element(
          'a',
          { href: 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/' },
          'NASA Blue Marble',
        ),
        ' · Positions: JPL DE441',
        empireCredit,
        ohmCredit,
        paleoCredit,
      ),
    ),
    notices,
    bottom,
    famousPanel.dialog,
  );

  // A tap on open sky or empty space hides the panels for a clear view; another brings them back.
  function togglePanels(): void {
    const hidden = root.dataset['panels'] !== 'hidden';
    root.dataset['panels'] = hidden ? 'hidden' : 'shown';
  }

  function notify(message: string): void {
    notices.append(element('li', {}, message));
  }
  parsed.warnings.forEach(notify);

  const [deltaT, lunarCatalog, solarCatalog, globe] = await Promise.all([
    DeltaT.load(`${base}data/delta-t.json`, (url) => fetch(url)),
    LunarCatalog.load(`${base}data/lunar/`, (url) => fetch(url)),
    SolarCatalog.load(`${base}data/solar/`, (url) => fetch(url)),
    createGlobe(globeContainer, {
      camera: store.get().camera,
      textureUrl: `${base}textures/earth-blue-marble-2048.jpg`,
      moonTextureUrl: `${base}textures/moon-lroc-1k.jpg`,
      focus: store.get().focus,
    }),
  ]);
  const sync = createUrlSync(browserUrlWriter(window.location, window.history));

  // The Moon's theory is a separate chunk; until it arrives the space view shows only the Sun.
  let moonEphemeris: MoonEphemeris | null = null;
  loadMoonEphemeris().then(
    (ephemeris) => {
      moonEphemeris = ephemeris;
      showTime(store.get());
      viewSwitch.render(store.get().mode, store.get().view, true);
      showSky(store.get());
    },
    (error: unknown) => {
      notify(`Could not load the Moon's orbit: ${errorMessage(error)}`);
    },
  );

  // The famous list is a convenience: if it fails to load, everything else still works.
  loadFamousEclipses(`${base}data/famous-eclipses.json`, (url) => fetch(url)).then(
    (entries) => {
      famous = entries;
      famousPanel.setEclipses(entries);
      renderSelection(store.get());
    },
    (error: unknown) => {
      famousPanel.button.hidden = true;
      notify(`Could not load the famous eclipses: ${errorMessage(error)}`);
    },
  );

  async function goToFamous(entry: FamousEclipse): Promise<void> {
    const date = famousDate(entry);
    const catalog = entry.kind === 'solar' ? solarCatalog : lunarCatalog;
    let eclipses: readonly Eclipse[];
    try {
      eclipses = await catalog.eclipsesInYear(date.year);
    } catch (error) {
      notify(`Could not load ${entry.title}: ${errorMessage(error)}`);
      return;
    }
    const match = findSelected(eclipses, { kind: entry.kind, date });
    if (match === undefined) {
      notify(`${entry.title} is not in the catalog.`);
      return;
    }
    flyToSelection = true;
    flyTarget = entry.place ?? null;
    store.set((state) => ({
      ...state,
      time: eclipseMoment(match),
      selection: eclipseSelection(match),
      location:
        entry.place === undefined
          ? state.location
          : { latitude: entry.place.latitude, longitude: entry.place.longitude },
    }));
  }

  /** The year on the bar: in the calendar picked, holding the moment shown. */
  function barYear(state: ViewState): number {
    return state.years === 'western'
      ? state.time.date.year
      : yearContaining(state.years, momentJulianDay(state.time));
  }

  /**
   * The same point in another year of the bar's calendar: the same date for western years, and
   * the same number of days into the year for the others.
   */
  function timeInYear(state: ViewState, year: number): ViewState['time'] {
    if (state.years === 'western') return moveToYear(state.time, astronomicalYear(year));
    const now = momentJulianDay(state.time);
    const from = yearSpan(state.years, barYear(state));
    const to = yearSpan(state.years, year);
    const into = Math.min(now - from.start, to.end - to.start - 1 / MINUTES_PER_DAY);
    return momentAt(julianDayNumber(to.start + into));
  }

  // Eclipses of the year on screen. Loads are tagged with their year so a slow response for a
  // year the user already left is ignored.
  let shownYear: string | null = null;
  let listing: YearEclipses = { status: 'loading' };
  let pathShownFor: SolarEclipse | null = null;

  // Which of those eclipses could be seen from a past state picked in the bar.
  let seenView: SeenView = { status: 'off' };
  let seenName: string | null = null;
  let seenListing: YearEclipses | null = null;
  let seenOptions: readonly string[] = [];
  let seenOptionsYear: number | null = null;

  function selectedEclipse(state: ViewState): Eclipse | undefined {
    return listing.status === 'ready' ? findSelected(listing.eclipses, state.selection) : undefined;
  }

  /** Everything that changes with the moment shown: scrubber, shadow, Moon-up region, card. */
  function renderMoment(state: ViewState): void {
    const selected = selectedEclipse(state);
    if (selected === undefined) {
      globe.setSolarShadow(null);
      globe.setLunarOverlay(null);
      scrubber.render(null);
      card.render(undefined, 0, state.location);
      return;
    }
    const universal = momentJulianDay(state.time);
    const offset = Math.round((universal - greatestEclipseUT(selected)) * MINUTES_PER_DAY);
    const uncertainty = deltaT.uncertaintySeconds(greatestEclipseUT(selected));
    scrubber.render({
      offsetMinutes: Math.max(-SCRUB_RANGE_MINUTES, Math.min(SCRUB_RANGE_MINUTES, offset)),
      timeLabel: formatTimeOfDay(state.time),
    });

    const showShadow = isSolar(selected) && state.layers.has('solar');
    globe.setSolarShadow(
      showShadow
        ? shadowAt(
            selected.elements,
            julianDayNumber(universal + selected.deltaT / 86_400),
            selected.deltaT,
          )
        : null,
    );

    // Where the eclipsed Moon is up now: the point under the Moon drifts west as Earth turns,
    // and the region only shows while the eclipse is actually happening.
    const phase = isSolar(selected) ? 'none' : lunarPhaseAt(selected, offset);
    if (!isSolar(selected) && phase !== 'none' && state.layers.has('lunar')) {
      const [latitude, longitude] = selected.sublunar;
      const now = shiftLongitude(
        { latitude, longitude },
        -(offset / 60) * SUBLUNAR_DRIFT_DEGREES_PER_HOUR,
      );
      const shift = longitudeUncertainty(uncertainty);
      globe.setLunarOverlay({
        sublunar: geoToVector(now),
        west: geoToVector(shiftLongitude(now, -shift)),
        east: geoToVector(shiftLongitude(now, shift)),
        strength: phase === 'penumbral' ? 0.5 : 1,
      });
    } else {
      globe.setLunarOverlay(null);
    }
    card.render(selected, uncertainty, state.location, famousFor(famous, state.selection), offset);
  }

  function renderSelection(state: ViewState): void {
    const selected = selectedEclipse(state);
    refreshSeen(state);
    timeline.render({
      year: barYear(state),
      calendar: state.years,
      eclipses: listing,
      selected,
      seen: { shown: seenShown(state), options: seenOptions, view: seenView },
    });
    const uncertainty =
      selected === undefined ? 0 : deltaT.uncertaintySeconds(greatestEclipseUT(selected));

    const solarPath =
      selected !== undefined && isSolar(selected) && state.layers.has('solar') ? selected : null;
    if (solarPath !== pathShownFor) {
      pathShownFor = solarPath;
      globe.setSolarPath(
        solarPath === null
          ? null
          : {
              elements: solarPath.elements,
              deltaTSeconds: solarPath.deltaT,
              uncertaintySeconds: uncertainty,
            },
      );
    }

    if (selected !== undefined && flyToSelection) {
      flyToSelection = false;
      const [latitude, longitude] = isSolar(selected) ? selected.greatest : selected.sublunar;
      globe.flyTo(flyTarget ?? { latitude, longitude });
      flyTarget = null;
    }
    renderMoment(state);
  }

  /** The western years a year of the bar spans: one, or two for a year starting mid-way. */
  function westernYearsOf(state: ViewState, year: number): readonly AstronomicalYear[] | null {
    if (state.years === 'western') return [astronomicalYear(year)];
    try {
      const { start, end } = yearSpan(state.years, year);
      const first = yearContaining('western', start);
      const last = yearContaining('western', julianDayNumber(end - 1 / MINUTES_PER_DAY));
      return Array.from({ length: last - first + 1 }, (_, index) =>
        astronomicalYear(first + index),
      );
    } catch {
      return null; // Before the start of the Julian Day count.
    }
  }

  function loadYear(state: ViewState): void {
    const year = barYear(state);
    const key = `${state.years}:${String(year)}`;
    if (key === shownYear) return;
    shownYear = key;
    const westernYears = westernYearsOf(state, year);
    const covered = (westernYears ?? []).every(
      (each) => lunarCatalog.covers(each) && solarCatalog.covers(each),
    );
    if (westernYears === null || !covered) {
      listing = {
        status: 'error',
        message: `Eclipses are catalogued from ${formatYear(astronomicalYear(lunarCatalog.index.startYear))} to ${formatYear(astronomicalYear(lunarCatalog.index.endYear))}`,
      };
      renderSelection(state);
      return;
    }
    const span = state.years === 'western' ? null : yearSpan(state.years, year);
    listing = { status: 'loading' };
    renderSelection(state);
    Promise.all(
      westernYears.flatMap((each) => [
        lunarCatalog.eclipsesInYear(each),
        solarCatalog.eclipsesInYear(each),
      ]),
    ).then(
      (chunks) => {
        if (shownYear !== key) return;
        const eclipses: Eclipse[] = chunks
          .flat()
          .filter((eclipse) => {
            if (span === null) return true;
            const when = greatestEclipseUT(eclipse);
            return when >= span.start && when < span.end;
          })
          .sort((a, b) => a.jdTT - b.jdTT);
        listing = { status: 'ready', eclipses };
        renderSelection(store.get());
      },
      (error: unknown) => {
        if (shownYear !== key) return;
        listing = { status: 'error', message: `Could not load eclipses: ${errorMessage(error)}` };
        renderSelection(store.get());
      },
    );
  }

  function showTime(state: ViewState): void {
    const universal = momentJulianDay(state.time);
    let terrestrial;
    try {
      terrestrial = deltaT.terrestrialTime(universal);
    } catch (error) {
      notify(`${errorMessage(error)}. Showing today instead.`);
      store.set({ ...state, time: defaultViewState(now).time, selection: null });
      return;
    }
    const sun = subsolarPoint(universal, terrestrial);
    globe.setSunDirection(geoToVector(sun));
    globe.setSpace({
      earthFixedToJ2000: earthFixedToJ2000(universal, terrestrial),
      sunKm: sunPositionJ2000(terrestrial),
      moonKm: moonEphemeris?.position(terrestrial) ?? null,
      planetsKm: planetPositions(terrestrial),
    });
    root.dataset['subsolar'] = `${sun.latitude.toFixed(3)},${sun.longitude.toFixed(3)}`;
    if (state.ma !== null) {
      showDeepTimeText(state.ma);
      return;
    }
    dateText.textContent = formatDate(state.time);
    timeText.textContent = formatTimeOfDay(state.time);
    const seconds = deltaT.seconds(universal);
    const uncertainty = deltaT.uncertaintySeconds(universal);
    // In another calendar, the same day written its way too (by day, from midnight).
    const other = state.years === 'western' ? '' : ` · ${formatInCalendar(state.years, universal)}`;
    detailText.textContent = `${formatCalendar(state.time)}${other} · ΔT ${formatDuration(seconds)} ± ${formatDuration(uncertainty)}`;
  }

  // The sky view, its code and its 9,000 stars load the first time someone opens it.
  let skyScene: SkyScene | null = null;
  let skyLoading = false;
  let panelInsets = { top: 0, bottom: 0 };
  function openSky(): void {
    if (skyScene !== null || skyLoading) return;
    skyLoading = true;
    Promise.all([
      import('./sky/skyScene'),
      loadSky(`${base}data/sky.json`, (url) => fetch(url)),
      loadHipStars(`${base}data/hip-stars.json`, (url) => fetch(url)),
      loadPlanets(),
    ]).then(
      ([{ createSkyScene }, plainSky, hipStars]) => {
        const state = store.get();
        // Other cultures' figures use a few faint stars beyond the catalogue; add them.
        const { sky, index } = withFigureStars(plainSky, hipStars);
        hipIndex = index;
        skyScene = createSkyScene(skyContainer, {
          sky,
          look: state.look,
          figures: state.figures,
          moonTextureUrl: `${base}textures/moon-lroc-1k.jpg`,
        });
        skyScene.setInsets(panelInsets.top, panelInsets.bottom);
        skyScene.onTap(togglePanels);
        skyScene.onLookChange((look) => {
          store.set((current) => ({ ...current, look }));
        });
        showSky(state);
      },
      (error: unknown) => {
        skyLoading = false;
        notify(`Could not load the stars: ${errorMessage(error)}`);
      },
    );
  }

  // Borders of past states load a century at a time, the first time the layer is on.
  let empireIndex: Promise<EmpireIndex> | null = null;
  const empireCenturies = new Map<number, Promise<EmpireCentury>>();
  let empiresShown: string | null = null;
  const ohmCenturies = new Map<number, Promise<OhmCentury>>();
  let ohmIndex: Promise<OhmIndex> | null = null;

  /** One century file, loaded once and kept; a failed load is retried next time. */
  function centuryFile<T>(
    cache: Map<number, Promise<T>>,
    century: number,
    load: () => Promise<T>,
  ): Promise<T> {
    let file = cache.get(century);
    if (file === undefined) {
      file = load();
      file.catch(() => cache.delete(century));
      cache.set(century, file);
    }
    return file;
  }

  const fetchJson = (url: string): Promise<Response> => fetch(url);

  /** Cliopatria's file for the century of `year`, or null if there is none. */
  function empireCenturyFor(year: number): Promise<EmpireCentury | null> {
    empireIndex ??= loadEmpireIndex(`${base}data/empires/index.json`, fetchJson);
    return empireIndex.then((index) => {
      const century = centuryFor(index, year);
      if (century === null) return null;
      return centuryFile(empireCenturies, century, () =>
        loadEmpireCentury(`${base}data/empires/${String(century)}.json`, fetchJson),
      );
    });
  }

  // A state's territory, kept while its borders stay the same so its region is prepared once.
  const territories = new WeakMap<object, Territory>();
  async function territoryOf(name: string, year: number): Promise<Territory | null> {
    const file = await empireCenturyFor(year);
    if (file === null) return null;
    const polities = file.polities.filter(
      (polity) => polity.name === name && polity.from <= year && year <= polity.to,
    );
    const first = polities[0];
    if (first === undefined) return null;
    let territory = territories.get(first);
    if (territory === undefined) {
      const parts = territoriesIn({ ...file, polities }, year);
      territory = { name, wikipedia: first.wikipedia, rings: parts.flatMap(({ rings }) => rings) };
      territories.set(first, territory);
    }
    return territory;
  }

  const empireEclipses = createEmpireEclipses({
    territory: territoryOf,
    async eclipses(year) {
      const each = astronomicalYear(year);
      if (!lunarCatalog.covers(each) || !solarCatalog.covers(each)) return null;
      const [lunar, solar] = await Promise.all([
        lunarCatalog.eclipsesInYear(each),
        solarCatalog.eclipsesInYear(each),
      ]);
      return [...lunar, ...solar].sort((a, b) => a.jdTT - b.jdTT);
    },
    uncertainty: (eclipse) => deltaT.uncertaintySeconds(greatestEclipseUT(eclipse)),
  });

  function seenShown(state: ViewState): boolean {
    return state.layers.has('empires') || state.seenIn !== null;
  }

  /** Bring the bar's "seen from" picker and marks up to date with the state and the year. */
  function refreshSeen(state: ViewState): void {
    const year = state.time.date.year;
    if (seenShown(state) && year !== seenOptionsYear) {
      seenOptionsYear = year;
      empireCenturyFor(year).then(
        (file) => {
          if (seenOptionsYear !== year) return;
          const names = file === null ? [] : territoriesIn(file, year).map(({ name }) => name);
          seenOptions = [...new Set(names)].sort((a, b) => a.localeCompare(b));
          renderSelection(store.get());
        },
        (error: unknown) => {
          seenOptionsYear = null;
          notify(`Could not load the states of the time: ${errorMessage(error)}`);
        },
      );
    }
    const name = state.seenIn;
    if (name === seenName && listing === seenListing) return;
    seenName = name;
    seenListing = listing;
    if (name === null) {
      seenView = { status: 'off' };
      return;
    }
    seenView = { status: 'loading', name };
    if (listing.status !== 'ready') return;
    const current = listing;
    // A year of another calendar can span two western years, each with its own borders.
    const byYear = new Map<number, Eclipse[]>();
    for (const eclipse of current.eclipses) {
      const each = yearOf(greatestEclipseUT(eclipse));
      byYear.set(each, [...(byYear.get(each) ?? []), eclipse]);
    }
    const years = byYear.size === 0 ? new Map([[year, []]]) : byYear;
    Promise.all(
      [...years].map(([each, eclipses]) => empireEclipses.seenInYear(name, each, eclipses)),
    ).then(
      (results) => {
        if (seenName !== name || seenListing !== current) return;
        const marks = results.filter((result) => result !== null);
        seenView =
          marks.length === 0
            ? { status: 'absent', name }
            : { status: 'ready', name, marks: new Map(marks.flatMap((result) => [...result])) };
        renderSelection(store.get());
      },
      (error: unknown) => {
        if (seenName !== name || seenListing !== current) return;
        seenView = { status: 'off' };
        notify(`Could not work out what ${name} saw: ${errorMessage(error)}`);
        renderSelection(store.get());
      },
    );
  }

  function goToEclipse(eclipse: Eclipse): void {
    flyToSelection = true;
    store.set((state) => ({
      ...state,
      time: eclipseMoment(eclipse),
      selection: eclipseSelection(eclipse),
    }));
  }

  /** The previous or next eclipse seen from the state picked: this year first, then further. */
  function stepSeen(direction: 1 | -1): void {
    const state = store.get();
    const name = state.seenIn;
    if (name === null) return;
    const selected = selectedEclipse(state);
    const pivot =
      selected === undefined ? momentJulianDay(state.time) : greatestEclipseUT(selected);
    if (listing.status === 'ready' && seenView.status === 'ready') {
      const { marks } = seenView;
      const later = listing.eclipses.filter((eclipse) => {
        const mark = marks.get(eclipse);
        if (mark === undefined || mark.verdict === 'not') return false;
        const when = greatestEclipseUT(eclipse);
        return direction === 1 ? when > pivot : when < pivot;
      });
      const pick = direction === 1 ? later.at(0) : later.at(-1);
      if (pick !== undefined) {
        goToEclipse(pick);
        return;
      }
    }
    const western = westernYearsOf(state, barYear(state)) ?? [state.time.date.year];
    const from = direction === 1 ? western.at(-1) : western.at(0);
    seenView = { status: 'searching', name };
    renderSelection(state);
    empireEclipses.nearest(name, from ?? state.time.date.year, direction).then(
      (found) => {
        if (store.get().seenIn !== name) return;
        if (found !== null) {
          goToEclipse(found.eclipse);
          return;
        }
        const way = direction === 1 ? 'after' : 'before';
        notify(`No eclipse seen from ${name} in the ${String(SEARCH_YEARS)} years ${way} this one`);
        seenListing = null; // Recompute this year's marks.
        renderSelection(store.get());
      },
      (error: unknown) => {
        notify(`Could not search for eclipses: ${errorMessage(error)}`);
        seenListing = null;
        renderSelection(store.get());
      },
    );
  }

  // Deep time: Earth's surface from the elevation maps, which load a few at a time as needed.
  let paleoIndex: Promise<PaleoDemIndex> | null = null;
  let oldest: number = MA_RANGE.max;
  let playing = false;
  let playFrame = 0;
  let lastTick = 0;

  function showDeepTime(state: ViewState): void {
    const { ma } = state;
    deepButton.setAttribute('aria-pressed', String(ma !== null));
    bottom.dataset['deep'] = ma === null ? 'off' : 'on';
    paleoCredit.hidden = ma === null;
    if (ma === null) {
      stopPlay();
      deepBar.render(null);
      globe.setDeepTime(null);
      return;
    }
    const period = periodAt(ma);
    showDeepTimeText(ma);
    deepBar.render({ ma, oldest, period, playing });
    paleoIndex ??= loadPaleoDemIndex(`${base}data/paleodem/index.json`, fetchJson);
    paleoIndex.then(
      (index) => {
        oldest = oldestMa(index);
        if (store.get().ma !== ma) return;
        const { younger, older, mix } = framesAround(index, ma);
        globe.setDeepTime({
          younger: `${base}data/paleodem/${younger.file}`,
          older: `${base}data/paleodem/${older.file}`,
          mix,
          columns: index.columns,
          rows: index.rows,
          seaDepth: index.seaDepth,
          landHeight: index.landHeight,
        });
      },
      (error: unknown) => {
        paleoIndex = null;
        notify(`Could not load Earth's past surface: ${errorMessage(error)}`);
      },
    );
  }

  /** The header in deep time: how long ago, and the period by the ICS chart. */
  function showDeepTimeText(ma: number): void {
    const period = periodAt(ma);
    dateText.textContent = formatMa(ma);
    timeText.textContent = '';
    detailText.textContent =
      period === null ? 'Deep time' : `${period.name} period · ${period.era} era`;
  }

  /** Play towards the present; from today, start again at the oldest map. */
  function startPlay(): void {
    if (playing) return;
    playing = true;
    if ((store.get().ma ?? 0) <= 0) store.set((state) => ({ ...state, ma: oldest }));
    lastTick = performance.now();
    playFrame = requestAnimationFrame(tick);
    showDeepTime(store.get());
  }

  function tick(now: number): void {
    const seconds = Math.min((now - lastTick) / 1000, 0.25);
    lastTick = now;
    const ma = store.get().ma;
    if (ma === null) {
      stopPlay();
      return;
    }
    const next = Math.max(0, Math.round((ma - PLAY_MA_PER_SECOND * seconds) * 10) / 10);
    store.set((state) => ({ ...state, ma: next }));
    if (next <= 0) {
      stopPlay();
      return;
    }
    playFrame = requestAnimationFrame(tick);
  }

  function stopPlay(): void {
    if (!playing) return;
    playing = false;
    cancelAnimationFrame(playFrame);
    showDeepTime(store.get());
  }

  function showEmpires(state: ViewState): void {
    // Past states belong to historical time, not deep time.
    const on = state.layers.has('empires') && state.ma === null;
    layerSwitch.render(on, state.mode === 'globe', state.borders);
    const source = state.borders;
    empireCredit.hidden = !on || source === 'ohm';
    ohmCredit.hidden = !on || source === 'cliopatria';
    const year = state.time.date.year;
    const key = on ? `${source}:${String(year)}` : null;
    if (key === empiresShown) return;
    empiresShown = key;
    if (!on) {
      globe.setEmpires(null);
      return;
    }
    ohmIndex ??= loadOhmIndex(`${base}data/ohm/index.json`, fetchJson);
    const territories =
      source === 'ohm'
        ? Promise.resolve([])
        : empireCenturyFor(year).then((file) => (file === null ? [] : territoriesIn(file, year)));
    const ohm =
      source === 'cliopatria'
        ? Promise.resolve(null)
        : ohmIndex.then(async (index) => {
            const century = Math.floor(year / 100) * 100;
            if (!index.centuries.includes(century)) return { borders: [], labels: [] };
            const file = await centuryFile(ohmCenturies, century, () =>
              loadOhmCentury(`${base}data/ohm/${String(century)}.json`, fetchJson),
            );
            return ohmIn(file, year);
          });
    Promise.all([territories, ohm]).then(
      ([drawn, lines]) => {
        // The year or source may have moved on while the files loaded.
        if (empiresShown !== key) return;
        globe.setEmpires({ territories: drawn, ohm: lines });
      },
      (error: unknown) => {
        empiresShown = null;
        notify(`Could not load the borders of past states: ${errorMessage(error)}`);
      },
    );
  }

  // SDO's images of the Sun load the first time someone looks at it close up.
  let sunImages: SunImages | null = null;
  let sunImagesLoading = false;
  function showSun(state: ViewState): void {
    const close = state.mode === 'globe' && state.focus === 'sun';
    sunSwitch.render(state.sunLayer, close);
    if (!close) {
      globe.setSunImage(null);
      return;
    }
    if (sunImages === null) {
      if (sunImagesLoading) return;
      sunImagesLoading = true;
      loadSunImages(`${base}data/sun-images.json`, (url) => fetch(url)).then(
        (images) => {
          sunImages = images;
          sunSwitch.setLayers(images.layers, images.credit);
          showSun(store.get());
        },
        (error: unknown) => {
          sunImagesLoading = false;
          notify(`Could not load the images of the Sun: ${errorMessage(error)}`);
        },
      );
      return;
    }
    const image = sunImages.layers.find(({ key }) => key === state.sunLayer);
    if (image === undefined) return;
    globe.setSunImage({
      key: image.key,
      small: `${base}${image.files['512']}`,
      large: `${base}${image.files['2048']}`,
      // Visible light comes as grey; the Sun's own light is a warm white.
      tint: image.key === 'visible' ? [1, 0.93, 0.8] : [1, 1, 1],
      diskRadius: sunImages.diskRadius,
      // HMI's continuum darkens toward the limb like the Sun seen by eye.
      limbDarkening: image.key === 'visible' ? 0.6 : 0,
    });
  }

  // The planets' theory loads with the sky view, or when the space view zooms out far enough to
  // show them, or centres on one.
  let planets: PlanetEphemeris | null = null;
  let planetsLoading: Promise<PlanetEphemeris> | null = null;
  function loadPlanets(): Promise<PlanetEphemeris> {
    planetsLoading ??= loadPlanetEphemeris().then((theory) => {
      planets = theory;
      showTime(store.get());
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

  function planetPositions(
    jdTT: JulianDay,
  ): Readonly<Record<PlanetName, readonly [number, number, number]>> | null {
    if (planets === null) return null;
    const theory = planets;
    return Object.fromEntries(
      PLANETS.map((planet) => [planet, theory.position(planet, jdTT)]),
    ) as Record<PlanetName, readonly [number, number, number]>;
  }
  const KM_PER_AU = 149_597_870.7;
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
    return PLANETS.map((planet, index) => {
      const fromEarth = elementAt(cached, index);
      const [x, y, z] = fromEarth;
      const [sx, sy, sz] = [sun[0] - x, sun[1] - y, sun[2] - z];
      const delta = Math.hypot(x, y, z);
      const r = Math.hypot(sx, sy, sz);
      // Phase angle: at the planet, between the Sun and Earth.
      const cosine = -(sx * x + sy * y + sz * z) / (r * delta);
      const phase = (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI;
      return {
        name: `${planet[0]?.toUpperCase() ?? ''}${planet.slice(1)}`,
        direction: topocentric(fromEarth, observer),
        magnitude: planetMagnitude(
          planet,
          r / KM_PER_AU,
          delta / KM_PER_AU,
          phase,
          planet === 'saturn' ? saturnRingTilt(fromEarth) : 0,
        ),
      };
    });
  }

  // Each culture's figures load the first time someone picks it.
  let hipIndex: ReadonlyMap<number, number> | null = null;
  const cultureFiles = new Map<SkyCulture, Promise<readonly Figure[]>>();
  function showCulture(state: ViewState): void {
    cultureSwitch.render(state.culture, state.mode === 'sky');
    if (skyScene === null || hipIndex === null) return;
    const culture = state.culture;
    if (culture === 'modern') {
      skyScene.setCulture(null);
      return;
    }
    const index = hipIndex;
    let figures = cultureFiles.get(culture);
    if (figures === undefined) {
      const request = loadCultureIndex(`${base}skycultures/${culture}/index.json`, (url) =>
        fetch(url),
      ).then((file) => cultureFigures(culture, file, index));
      // A failure is reported once per request, however many renders were waiting on it.
      request.catch((error: unknown) => {
        if (cultureFiles.get(culture) !== request) return;
        cultureFiles.delete(culture);
        notify(`Could not load the ${culture} sky: ${errorMessage(error)}`);
      });
      cultureFiles.set(culture, request);
      figures = request;
    }
    figures.then(
      (loaded) => {
        if (store.get().culture === culture) skyScene?.setCulture(loaded);
      },
      () => {
        // Reported above.
      },
    );
  }

  /** The name of a culture's observing site, if the observer stands right there. */
  function namedPlace(place: GeoPoint): string | null {
    const site = Object.values(CULTURE_INFO).find(
      (info) =>
        info.place !== null &&
        Math.abs(info.place.latitude - place.latitude) < 0.01 &&
        Math.abs(info.place.longitude - place.longitude) < 0.01,
    );
    return site?.place?.name ?? null;
  }

  function observerOf(state: ViewState): GeoPoint {
    if (state.location !== null) return state.location;
    return state.focus === 'earth' ? state.camera.target : DEFAULT_CAMERA.target;
  }

  /** Where the Sun or Moon stands, from Earth's centre and from the observer, in km. */
  function bodiesSeen(state: ViewState) {
    const place = observerOf(state);
    const jdUT = momentJulianDay(state.time);
    let jdTT;
    try {
      jdTT = deltaT.terrestrialTime(jdUT);
    } catch {
      return null; // showTime has already said so and moved to today.
    }
    return {
      place,
      jdUT,
      jdTT,
      observer: observerPosition(place, longTermEarthFixedToJ2000(jdUT, jdTT)),
      sun: sunPositionJ2000(jdTT),
      moon: moonEphemeris?.position(jdTT) ?? null,
    };
  }

  /** A look facing the Sun or the Moon from where the observer stands, or null if unknown. */
  function aimAt(state: ViewState, target: AimTarget): ViewState['look'] | null {
    const seen = bodiesSeen(state);
    if (seen === null) return null;
    const body: Vector3 | null = target === 'sun' ? seen.sun : seen.moon;
    if (body === null) return null;
    const horizon = horizonMatrix(seen.place, seen.jdUT, seen.jdTT);
    const { azimuth, altitude } = horizontalOf(horizon, topocentric(body, seen.observer));
    return roundLook({
      azimuth,
      altitude: Math.max(LOWEST_LOOK, altitude),
      fov: Math.min(state.look.fov, AIM_FOV),
    });
  }

  function showSky(state: ViewState): void {
    const inSky = state.mode === 'sky';
    globeContainer.hidden = inSky;
    skyText.hidden = !inSky;
    skyEclipse.hidden = true;
    figureSwitch.render(state.figures, inSky, state.culture === 'modern');
    cultureSwitch.render(state.culture, inSky);
    aimSwitch.render(inSky, moonEphemeris !== null);
    if (!inSky) {
      skyScene?.setVisible(false);
      return;
    }
    openSky();
    const seen = bodiesSeen(state);
    if (seen === null) return;
    const { place, jdUT, jdTT } = seen;
    const planetCaveat = planetNote(state.time.date.year);
    skyText.textContent = [
      skyCaption({
        place,
        placeName: namedPlace(place),
        azimuth: state.look.azimuth,
        uncertaintySeconds: deltaT.uncertaintySeconds(jdUT),
      }),
      planetCaveat,
    ]
      .filter((part) => part !== '')
      .join(' ');
    const horizon = horizonMatrix(place, jdUT, jdTT);
    const sunHere = topocentric(seen.sun, seen.observer);
    const moonHere = seen.moon === null ? null : topocentric(seen.moon, seen.observer);
    skyEclipse.textContent =
      seen.moon === null || moonHere === null
        ? ''
        : eclipseNote({
            sunVisible: sunVisible(sunHere, moonHere),
            sunAltitude: horizontalOf(horizon, sunHere).altitude,
            moonSunlight: moonSunlight(seen.moon, seen.sun),
            moonAltitude: horizontalOf(horizon, moonHere).altitude,
          });
    skyEclipse.hidden = skyEclipse.textContent === '';
    if (skyScene === null) return;
    skyScene.setLook(state.look);
    skyScene.setFigures(state.figures);
    showCulture(state);
    skyScene.setMoment({
      horizon,
      jdTT,
      sun: seen.sun,
      moon: seen.moon,
      observer: seen.observer,
      planets: planetsSeen(jdTT, seen.sun, seen.observer),
      velocity: earthVelocity((jd) => sunPositionJ2000(julianDayNumber(jd)), jdTT),
    });
    skyScene.setVisible(true);
  }

  function render(state: ViewState, previous: ViewState | null): void {
    // Asked once: a failed load is reported once rather than on every move of the camera.
    if (planetsLoading === null && wantPlanets(state)) {
      loadPlanets().catch((error: unknown) => {
        notify(`Could not load the planets' orbits: ${errorMessage(error)}`);
      });
    }
    if (state.time !== previous?.time || state.years !== previous.years) showTime(state);
    if (
      state.ma !== previous?.ma ||
      state.time !== previous.time ||
      state.years !== previous.years
    ) {
      showDeepTime(state);
    }
    if (
      state.mode !== previous?.mode ||
      state.time !== previous.time ||
      state.location !== previous.location ||
      state.look !== previous.look ||
      state.figures !== previous.figures ||
      state.culture !== previous.culture ||
      state.focus !== previous.focus ||
      state.camera !== previous.camera
    ) {
      if (state.mode === 'sky' || previous?.mode === 'sky' || previous === null) showSky(state);
    }
    if (previous !== null && state.focus !== previous.focus) globe.setFocus(state.focus);
    if (
      state.focus !== previous?.focus ||
      state.mode !== previous.mode ||
      state.sunLayer !== previous.sunLayer
    ) {
      showSun(state);
    }
    if (
      state.layers !== previous?.layers ||
      state.mode !== previous.mode ||
      state.borders !== previous.borders ||
      state.ma !== previous.ma ||
      state.time.date.year !== previous.time.date.year
    ) {
      showEmpires(state);
    }
    if (state.location !== previous?.location) globe.setLocation(state.location);
    if (state.view !== previous?.view) globe.setViewpoint(state.view);
    if (state.view !== previous?.view || state.mode !== previous.mode) {
      viewSwitch.render(state.mode, state.view, moonEphemeris !== null);
    }
    if (state.years !== previous?.years || barYear(state) !== barYear(previous)) {
      loadYear(state);
    }
    if (
      state.selection !== previous?.selection ||
      state.layers !== previous.layers ||
      state.location !== previous.location ||
      state.seenIn !== previous.seenIn
    ) {
      renderSelection(state);
    } else if (state.time !== previous.time) {
      renderMoment(state);
    }
    sync.update(state);
  }

  store.subscribe((state, previous) => {
    render(state, previous);
  });
  render(store.get(), null);
  // Write the canonical, fully explicit URL straight away so it can be shared as is.
  sync.flush();

  // Keep the globe centred in the space the panels leave free. On wide screens the date panel
  // sits beside the globe, so only the bottom panels count.
  const top = root.querySelector('.hud');
  if (top !== null) {
    const update = (): void => {
      const narrow = window.innerWidth <= 600;
      panelInsets = {
        top: narrow ? top.getBoundingClientRect().bottom : 0,
        bottom: bottom.getBoundingClientRect().height,
      };
      globe.setInsets(panelInsets.top, panelInsets.bottom);
      skyScene?.setInsets(panelInsets.top, panelInsets.bottom);
    };
    const observer = new ResizeObserver(update);
    observer.observe(top);
    observer.observe(bottom);
  }

  globe.onBodyClick((focus) => {
    store.set((state) => ({ ...state, focus, view: 'free' }));
  });
  globe.onEmptyTap(togglePanels);
  globe.onPlacePick((place) => {
    const location = { latitude: round(place.latitude, 4), longitude: round(place.longitude, 4) };
    store.set((state) => ({ ...state, location }));
  });
  globe.onCameraChange((camera) => {
    store.set((state) => ({ ...state, camera }));
  });
  window.addEventListener('pagehide', () => {
    sync.flush();
  });
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
