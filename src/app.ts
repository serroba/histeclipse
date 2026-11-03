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
  eclipseMomentAt,
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
  DEEP_LAYERS,
  defaultViewState,
  type DeepScale,
  EARTH_AGE_MA,
  ICE_AGES_MA,
  LAST_GLACIAL_MAXIMUM_MA,
  type Layer,
  roundMa,
  momentJulianDay,
  type GeoPoint,
  type DispersalScenario,
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
import type { SkyMark, SkyScene } from './sky/skyScene';
import { DeltaT } from './time/deltaT';
import { formatCalendar, formatDate, formatDuration, formatTimeOfDay } from './time/format';
import { julianDayNumber, type JulianDay } from './time/julianDay';
import { formatInCalendar, yearContaining, yearSpan } from './time/calendars';
import { astronomicalYear, formatYear, type AstronomicalYear } from './time/year';
import { moveToYear } from './time/yearInput';
import { element } from './ui/dom';
import { createEclipseCard } from './ui/eclipseCard';
import { createFamousPanel } from './ui/famousPanel';
import { createWelcome } from './ui/welcome';
import { loadSeaIce, type SeaIceIndex, seaIceMix, seaIcePair } from './data/seaIce';
import { createMarkerCard } from './ui/markerCard';
import { createTabletPanel } from './ui/tabletPanel';
import { candidateYear, checkAll, type Verdict, verdictMoment } from './tablets/check';
import { BABYLON, directionOf, starsByNumber, type TabletSky } from './tablets/tabletSky';
import { bodyName, computedText, recordBodies } from './tablets/verdictText';
import { VAT_4956 } from './tablets/vat4956';
import { createScrubber, SCRUB_RANGE_MINUTES } from './ui/scrubber';
import { createAimSwitch, type AimTarget } from './ui/aimSwitch';
import { createSunSwitch } from './ui/sunSwitch';
import { createLayersPanel } from './ui/layersPanel';
import { createDeepGlance } from './ui/deepGlance';
import { cliopatriaYear } from './state/layerCatalog';
import { changesText, createHistoryTrack, STATES_HINT } from './ui/historyTrack';
import { yearPlayhead, type YearSpeed } from './time/yearPlay';
import {
  centuryFor,
  labelPoint,
  loadEmpireCentury,
  loadEmpireIndex,
  stateChanges,
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
import {
  type CoastlineView,
  createDeepTimeBar,
  type DeepTimeView,
  type SeaIceView,
  type TemperatureView,
} from './ui/deepTimeBar';
import { formatMa, periodAt, periodWords } from './deepTime/periods';
import { framesAround, loadPaleoDemIndex, oldestMa, type PaleoDemIndex } from './data/paleoDem';
import { loadPaleoTempIndex, type PaleoTempIndex } from './data/paleoTemp';
import { loadSeaLevel, type SeaLevelIndex } from './data/seaLevel';
import {
  iceFramesInMa,
  iceStandIn,
  type IceStandIn,
  loadIceSheets,
  oldestIceKa,
  type IceSheetIndex,
} from './data/iceSheets';
import {
  iceOutlinesAt,
  loadIceOutlines,
  type IceOutlineIndex,
  type IceOutlines,
} from './data/iceOutlines';
import {
  countryRings,
  loadNamedPeriods,
  periodsHere,
  periodsText,
  type NamedPeriods,
} from './data/namedPeriods';
import { loadPlateMotion, motionText, type PlateMotion } from './data/plateMotion';
import { loadRocks, rockAt, rockText, rockUnits, type RockUnit, type Rocks } from './data/rocks';
import { loadWaysOfLife, waysAt, waysNote, type WaysOfLife } from './data/waysOfLife';
import {
  genomesNear,
  genomesNote,
  genomeCellCard,
  loadAncientGenomes,
  type AncientGenomes,
} from './data/ancientGenomes';
import { loadAtmosphere, type Atmosphere } from './data/atmosphere';
import { fossilsAt, loadFossils, type Fossils } from './data/fossils';
import { impactDetails, impactsAt, impactsText, loadImpacts, type Impacts } from './data/impacts';
import {
  eruptionsNear,
  loadVolcanoDetails,
  loadVolcanoes,
  volcanoCard,
  volcanoesText,
  type VolcanoDetails,
  type VolcanoMark,
  type Volcanoes,
} from './data/volcanoes';
import { claimCard, humansAt, loadHumanClaims, type HumanClaims } from './data/humanClaims';
import { loadPictures, type Pictures } from './data/pictures';
import { loadArrivalGrid } from './globe/arrivalGrid';
import {
  loadDispersalIndex,
  settledShare,
  type ArrivalGrid,
  type DispersalIndex,
} from './data/dispersal';
import {
  loadPlateMasks,
  type PlateMaskIndex,
  platesBeyondText,
  plateText,
} from './data/plateMasks';
import { loadShelf, type ShelfIndex } from './data/shelf';
import { COAST_SOURCES, coastlineAt, type CoastSource } from './deepTime/coastline';
import {
  mapModel,
  meanAt,
  reachMa,
  TEMPERATURE_MODEL_FOLDERS,
  TEMPERATURE_MODEL_LABELS,
  TEMPERATURE_MODELS,
  type TemperatureIndexes,
  type TemperatureModel,
} from './deepTime/temperatureModels';
import { playhead } from './deepTime/playhead';
import { PLATES_REACH_MA, sketchAt } from './deepTime/sketch';
import { createTimeline, type Eclipse, type SeenView, type YearEclipses } from './ui/timeline';
import { elementAt } from './util/arrays';
import { errorMessage } from './util/errors';

const MINUTES_PER_DAY = 1440;
/** Field of view (degrees) when turning to the Sun or Moon: close enough to see the disc. */
const AIM_FOV = 12;
/** Earth radii (or the focused body's): beyond this the space view loads the planets. */
const PLANETS_SHOWN_BEYOND = 1000;
/** This year, up to which the latest borders of states carry on. */
const PRESENT_YEAR = new Date().getUTCFullYear();
/** The year “before present” counts back from, as radiocarbon dates do. */
const BP_ZERO_YEAR = 1950;

/** Deep time plays at this many million years per second: 540 Myr in about half a minute. */
const PLAY_MA_PER_SECOND = 20;
/** On the ice-age scale: 50,000 years a second, 2.6 million years in under a minute. */
const ICE_PLAY_MA_PER_SECOND = 0.05;
/** Over all of Earth's history: 100 million years a second, 4.6 billion in under a minute. */
const EONS_PLAY_MA_PER_SECOND = 100;
/** The elevation maps reach back this far (their index says for certain once loaded). */
const MAPS_REACH_MA = 540;
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
  const famousPanel = createFamousPanel(
    (entry) => {
      void goToFamous(entry);
    },
    () => {
      // The tablet is dated in the Babylonian calendar: switch to it, where its check lives.
      store.set((state) => ({ ...state, years: 'babylonian' }));
      tabletPanel.open();
    },
  );
  const tabletPanel = createTabletPanel({
    async check(bce, shift) {
      const sky = await tabletSky();
      const candidate = candidateYear(bce, shift);
      if (candidate === null) {
        throw new Error(`No Babylonian months are computed for ${String(bce)} BCE.`);
      }
      // Let "Computing the sky…" show before the work starts.
      await new Promise((resolve) => setTimeout(resolve, 0));
      return checkAll(sky, VAT_4956, candidate);
    },
    go(verdict) {
      void goToRecord(verdict);
    },
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
  const layersPanel = createLayersPanel(
    (layer, on) => {
      store.set((state) => {
        const layers = new Set(state.layers);
        if (on) layers.add(layer);
        else layers.delete(layer);
        return { ...state, layers };
      });
    },
    (borders) => {
      store.set((state) => ({ ...state, borders }));
    },
  );
  const markerCard = createMarkerCard();
  const rocksCredit = element(
    'span',
    { class: 'empire-credit', hidden: '' },
    ' · Rocks: ',
    element('a', { href: 'https://macrostrat.org' }, 'Macrostrat'),
    ' (Peters et al., CC BY 4.0)',
  );
  const periodsCredit = element(
    'span',
    { class: 'empire-credit', hidden: '' },
    ' · Periods: ',
    element('a', { href: 'https://perio.do' }, 'PeriodO'),
    ' (CC0), countries from Natural Earth',
  );
  const waysCredit = element(
    'span',
    { class: 'empire-credit', hidden: '' },
    ' · Ways of life: ',
    element('a', { href: 'https://doi.org/10.1126/science.aax1192' }, 'ArchaeoGLOBE'),
    ' (2019, CC0)',
  );
  const genomeCredit = element(
    'span',
    { class: 'empire-credit', hidden: '' },
    ' · Ancient genomes: ',
    element('a', { href: 'https://doi.org/10.7910/DVN/FFIDCW' }, 'Allen Ancient DNA Resource'),
    ' (Mallick et al. 2024, Reich lab; CC0)',
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
    ', repacked) · Temperature: ',
    element('a', { href: 'https://doi.org/10.5281/zenodo.5718392' }, 'Scotese 2022'),
    ', ',
    element('a', { href: 'https://doi.org/10.5281/zenodo.7322003' }, 'CESM, Li et al. 2023'),
    ' (CC BY 4.0) · Periods: ',
    element('a', { href: 'https://stratigraphy.org/chart' }, 'ICS chart v2026/06'),
  );
  // The two times the reader can be in, one always picked: the calendar's, and deep time's.
  const holoceneButton = element(
    'button',
    {
      type: 'button',
      class: 'time-option',
      'aria-pressed': 'true',
      title: 'The last 11,700 years: dates, states and eclipses',
    },
    'Holocene',
  );
  const deepButton = element(
    'button',
    {
      type: 'button',
      class: 'time-option',
      'aria-pressed': 'false',
      title: 'Millions of years: the ice ages, moving continents, Earth’s history',
    },
    'Deep time',
  );
  const timeSwitch = element(
    'div',
    { class: 'time-switch', role: 'group', 'aria-label': 'Time' },
    holoceneButton,
    deepButton,
  );
  // The eclipse picked before entering deep time, picked again on leaving it.
  let selectionBeforeDeep: ViewState['selection'] = null;
  function leaveDeepTime(): void {
    stopPlay();
    const selection = selectionBeforeDeep;
    selectionBeforeDeep = null;
    store.set((state) => {
      // Deep time's own layers go with it, so they don't linger in the link.
      const layers = new Set(state.layers);
      for (const layer of DEEP_LAYERS) layers.delete(layer);
      return { ...state, ma: null, layers, selection: state.selection ?? selection };
    });
  }
  holoceneButton.addEventListener('click', () => {
    if (store.get().ma !== null) leaveDeepTime();
  });
  /** Go into deep time at `ma`, on the span that reaches it. */
  function enterDeepTime(ma: number, deepScale?: DeepScale): void {
    selectionBeforeDeep = store.get().selection;
    sync.step();
    // Deep time shows the whole Earth: the globe, with no eclipse picked.
    store.set((state) => ({
      ...state,
      ma: roundMa(ma),
      ...(deepScale === undefined ? {} : { deepScale }),
      mode: 'globe',
      view: 'free',
      // The Sun, Moon and planets are left out of deep time, so the view centres on Earth.
      focus: 'earth',
      selection: null,
    }));
  }
  deepButton.addEventListener('click', () => {
    if (store.get().ma === null) enterDeepTime(DEEP_TIME_START_MA);
  });
  const deepBar = createDeepTimeBar({
    onMa(ma, jump) {
      stopPlay();
      if (jump) sync.step();
      store.set((state) => ({ ...state, ma: roundMa(ma) }));
    },
    onPlay(play) {
      if (play) startPlay();
      else stopPlay();
    },
    onPlates(on) {
      store.set((state) => {
        const layers = new Set(state.layers);
        if (on) layers.add('plates');
        else layers.delete('plates');
        return { ...state, layers };
      });
    },
    onDispersal(dispersal) {
      store.set((state) => ({ ...state, dispersal }));
    },
    onAir(on) {
      store.set((state) => {
        const layers = new Set(state.layers);
        if (on) layers.add('air');
        else layers.delete('air');
        return { ...state, layers };
      });
    },
    onImpacts(on) {
      store.set((state) => {
        const layers = new Set(state.layers);
        if (on) layers.add('impacts');
        else layers.delete('impacts');
        return { ...state, layers };
      });
    },
    onFossils(on) {
      store.set((state) => {
        const layers = new Set(state.layers);
        if (on) layers.add('fossils');
        else layers.delete('fossils');
        return { ...state, layers };
      });
    },
    onHumans(on) {
      store.set((state) => {
        const layers = new Set(state.layers);
        if (on) layers.add('humans');
        else layers.delete('humans');
        return { ...state, layers };
      });
    },
    onSeaLevel(on) {
      store.set((state) => {
        const layers = new Set(state.layers);
        if (on) layers.add('sealevel');
        else layers.delete('sealevel');
        return { ...state, layers };
      });
    },
    onCoast(coast) {
      store.set((state) => ({ ...state, coast }));
    },
    onSeaIce(seaIce) {
      store.set((state) => ({ ...state, seaIce }));
    },
    onScale(deepScale) {
      stopPlay();
      store.set((state) => {
        const ma = state.ma ?? 0;
        return {
          ...state,
          deepScale,
          // From further back than the ice ages, open them at the last glacial maximum; from
          // before the elevation maps, the 540 Myr scale opens at their oldest.
          ma:
            deepScale === 'ice' && ma > ICE_AGES_MA
              ? LAST_GLACIAL_MAXIMUM_MA
              : deepScale === 'all' && ma > oldest
                ? oldest
                : state.ma,
        };
      });
    },
    onTemperatureModel(temperatureModel) {
      store.set((state) => ({ ...state, temperatureModel }));
    },
    onSketch(choice) {
      store.set((state) => ({ ...state, ...choice }));
    },
    onTemperature(on) {
      store.set((state) => {
        const layers = new Set(state.layers);
        if (on) layers.add('temperature');
        else layers.delete('temperature');
        return { ...state, layers };
      });
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
  // Which constellations, and whose: folded on phones, where they would cover the sky itself.
  const skyOptions = element(
    'details',
    { class: 'sky-options', hidden: '' },
    element('summary', {}, 'Constellations and whose sky'),
    figureSwitch.root,
    cultureSwitch.root,
  );
  skyOptions.open = !window.matchMedia('(max-width: 600px)').matches;
  const skyEclipse = element('p', { class: 'sky-eclipse', 'data-testid': 'sky-eclipse' });
  // A tablet record being looked at: what it says, whether it fits, and the way back to the list.
  const recordText = element('span', { class: 'tablet-record-text' });
  const recordMark = element('span', { class: 'tablet-mark' });
  const recordBack = element(
    'button',
    { type: 'button', class: 'tablet-record-back' },
    'Back to the tablet',
  );
  const recordClose = element(
    'button',
    { type: 'button', class: 'tablet-record-close', 'aria-label': 'Stop pointing out the record' },
    '×',
  );
  const recordBanner = element(
    'div',
    { class: 'tablet-record', 'data-testid': 'tablet-record', hidden: '' },
    element('p', {}, recordText, ' ', recordMark),
    element('div', { class: 'tablet-record-actions' }, recordBack, recordClose),
  );
  const dateText = element('time', { class: 'hud-date' });
  const timeText = element('span', {
    class: 'hud-time',
    title: 'UT: Universal Time, the time of day at Greenwich, England',
    tabindex: '0',
  });
  const detailText = element('p', { class: 'hud-detail' });
  // A tap (or Enter) on a term with an explanation shows it here: phones have no hover.
  const termNote = element('p', { class: 'term-note', 'data-testid': 'term-note', hidden: '' });
  // By its text, since the line is rebuilt as time moves.
  let termShown: string | null = null;
  function explain(term: Element): void {
    const text = term.getAttribute('title');
    if (text === null || text === termShown) {
      termShown = null;
      termNote.hidden = true;
      return;
    }
    termShown = text;
    termNote.textContent = text;
    termNote.hidden = false;
  }
  const termOf = (target: EventTarget | null): Element | null =>
    target instanceof Element ? target.closest('.hud-detail abbr[title], .hud-time[title]') : null;
  for (const holder of [timeText, detailText]) {
    holder.addEventListener('click', (event) => {
      const term = termOf(event.target);
      if (term !== null) explain(term);
    });
    holder.addEventListener('keydown', (event) => {
      const term = termOf(event.target);
      if (term !== null && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        explain(term);
      }
    });
  }
  // A first visit (no link to follow, never welcomed before) gets one line on what this is and
  // where to start; it goes for good once closed, followed, or once something is picked.
  const welcome = createWelcome(window.location.search === '', () => {
    famousPanel.button.click();
  });
  const notices = element('ul', { class: 'notices', role: 'status', 'aria-live': 'polite' });
  // The panels hide for a clear view, by this button or a tap on empty space; one button brings
  // them back.
  const fullView = element(
    'button',
    { type: 'button', class: 'full-view', 'aria-label': 'Hide the panels for a full view' },
    'Full view',
  );
  fullView.addEventListener('click', togglePanels);
  const showControls = element(
    'button',
    { type: 'button', class: 'show-controls' },
    'Show controls',
  );
  showControls.addEventListener('click', togglePanels);
  const glance = createDeepGlance(
    (play) => {
      if (play) startPlay();
      else stopPlay();
    },
    (ma) => {
      stopPlay();
      store.set((state) => ({ ...state, ma: roundMa(ma) }));
    },
  );
  const card = createEclipseCard();
  // The Holocene track: the years played by, from as far back as ΔT reaches to the present.
  let historySpeed: YearSpeed = 50;
  let historyPlaying = false;
  let historyFrame = 0;
  let historyTick = 0;
  let historyHead = yearPlayhead();
  // What the track last said of the states, and what was drawn then, to tell what changed.
  let statesSaid = 'Which states appear and which are gone shows here as the years go by.';
  let statesBefore: { readonly year: number; readonly names: readonly string[] } | null = null;
  const historyTrack = createHistoryTrack({
    onYear(year) {
      stopHistory();
      setYear(year);
    },
    onPlay(play) {
      if (play) startHistory();
      else stopHistory();
    },
    onSpeed(speed) {
      historySpeed = speed;
      showHistory(store.get());
    },
  });

  function historyFirst(): number {
    return Math.ceil(deltaT.firstYear) + 1;
  }

  function setYear(year: number): void {
    store.set((state) => ({
      ...state,
      time: moveToYear(state.time, astronomicalYear(year)),
      selection: null,
    }));
  }

  function startHistory(): void {
    if (store.get().time.date.year >= PRESENT_YEAR) setYear(historyFirst());
    historyPlaying = true;
    historyHead = yearPlayhead();
    historyTick = performance.now();
    historyFrame = requestAnimationFrame(tickHistory);
    showHistory(store.get());
  }

  // A new year at most every 80 ms: each brings its eclipses and borders to load.
  const HISTORY_STEP_SECONDS = 0.08;
  function tickHistory(now: number): void {
    if (!historyPlaying) return;
    const seconds = (now - historyTick) / 1000;
    if (seconds >= HISTORY_STEP_SECONDS) {
      historyTick = now;
      const year = store.get().time.date.year;
      const next = historyHead.step(year, historySpeed, seconds, PRESENT_YEAR);
      if (next !== year) setYear(next);
      if (next >= PRESENT_YEAR) {
        stopHistory();
        return;
      }
    }
    historyFrame = requestAnimationFrame(tickHistory);
  }

  function stopHistory(): void {
    if (!historyPlaying) return;
    historyPlaying = false;
    cancelAnimationFrame(historyFrame);
    showHistory(store.get());
  }

  function showHistory(state: ViewState): void {
    historyTrack.render({
      year: state.time.date.year,
      first: historyFirst(),
      last: PRESENT_YEAR,
      playing: historyPlaying,
      speed: historySpeed,
      changes: state.layers.has('empires') ? statesSaid : STATES_HINT,
    });
  }

  /** Note which states appeared or went since the year drawn before, if it was near. */
  function noteStates(year: number, names: readonly string[]): void {
    const before = statesBefore;
    statesBefore = { year, names };
    // Far apart, a list of what differs says little about what happened.
    if (before === null || Math.abs(year - before.year) > 500) return;
    const { appeared, gone } = stateChanges(before.names, names);
    const said = changesText(year, appeared, gone);
    if (said !== null) statesSaid = said;
    showHistory(store.get());
  }

  const timeline = createTimeline(
    {
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
          time: eclipseMomentAt(eclipse, state.location),
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
    },
    [famousPanel.button, historyTrack.button, tabletPanel.button],
  );
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
    historyTrack.root,
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
      fullView,
      element('p', { class: 'hud-when' }, dateText, ' ', timeText),
      detailText,
      termNote,
      welcome.root,
      element('div', { class: 'hud-actions' }, timeSwitch, layersPanel.button),
      viewSwitch.root,
      aimSwitch.root,
      skyOptions,
      sunSwitch.root,
      skyText,
      skyEclipse,
      recordBanner,
      element(
        'details',
        { class: 'credits' },
        element('summary', {}, 'Sources'),
        'Earth: ',
        element(
          'a',
          { href: 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/' },
          'NASA Blue Marble',
        ),
        ' · Positions: JPL DE441',
        ' · Sun close up: ',
        element('a', { href: 'https://sdo.gsfc.nasa.gov/' }, 'NASA SDO'),
        ' via ',
        element('a', { href: 'https://helioviewer.org/' }, 'Helioviewer'),
        ', images of 2024 days apart stitched into one surface',
        empireCredit,
        genomeCredit,
        waysCredit,
        periodsCredit,
        rocksCredit,
        ohmCredit,
        paleoCredit,
      ),
    ),
    notices,
    glance.root,
    showControls,
    bottom,
    famousPanel.dialog,
    tabletPanel.dialog,
    layersPanel.dialog,
    markerCard.dialog,
  );

  // Full view hides the panels for a clear view; Show controls, Escape, or a tap on open sky or
  // empty space brings them back. A stray tap never hides them.
  function togglePanels(): void {
    const hidden = root.dataset['panels'] !== 'hidden';
    root.dataset['panels'] = hidden ? 'hidden' : 'shown';
    if (!hidden) fullView.focus();
    else showControls.focus();
  }

  function showPanels(): void {
    if (root.dataset['panels'] === 'hidden') togglePanels();
  }

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') showPanels();
  });

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
    store.set((state) => {
      const location =
        entry.place === undefined
          ? state.location
          : { latitude: entry.place.latitude, longitude: entry.place.longitude };
      return {
        ...state,
        time: eclipseMomentAt(match, location),
        selection: eclipseSelection(match),
        location,
      };
    });
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
      card.render(undefined, 0, null);
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
    const famousHere = famousFor(famous, state.selection);
    card.render(
      selected,
      uncertainty,
      state.location === null
        ? null
        : { point: state.location, name: placeName(state.location, famousHere) },
      famousHere,
      offset,
    );
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
    // ΔT is a term few readers know: it explains itself on hover, or on a tap.
    detailText.replaceChildren(
      `${formatCalendar(state.time)}${other} · `,
      element(
        'abbr',
        { title: DELTA_T_MEANING, tabindex: '0' },
        `ΔT ${formatDuration(seconds)} ± ${formatDuration(uncertainty)}`,
      ),
    );
  }

  const DELTA_T_MEANING =
    'ΔT: how far Earth’s slowing spin has put clock time behind a perfectly even time. It decides where on Earth an ancient eclipse fell; the ± is how uncertain it is.';

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
        skyScene.onTap(showPanels);
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
      const century = centuryFor(index, cliopatriaYear(year, PRESENT_YEAR));
      if (century === null) return null;
      return centuryFile(empireCenturies, century, () =>
        loadEmpireCentury(`${base}data/empires/${String(century)}.json`, fetchJson),
      );
    });
  }

  // A state's territory, kept while its borders stay the same so its region is prepared once.
  const territories = new WeakMap<object, Territory>();
  async function territoryOf(name: string, shown: number): Promise<Territory | null> {
    const year = cliopatriaYear(shown, PRESENT_YEAR);
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
          const names =
            file === null
              ? []
              : territoriesIn(file, cliopatriaYear(year, PRESENT_YEAR)).map(({ name }) => name);
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
      time: eclipseMomentAt(eclipse, state.location),
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
  // Each model's temperature maps load the first time the layer is asked for.
  let tempLoading: Readonly<Record<TemperatureModel, Promise<PaleoTempIndex> | null>> = {
    scotese: null,
    cesm: null,
  };
  let tempIndexes: TemperatureIndexes = { scotese: null, cesm: null };
  // Sea level, likewise: asked for once, drawn when it arrives.
  let seaLevelLoading: Promise<SeaLevelIndex> | null = null;
  let seaLevelIndex: SeaLevelIndex | null = null;
  let shelfLoading: Promise<ShelfIndex> | null = null;
  let shelfIndex: ShelfIndex | null = null;
  let platesLoading: Promise<PlateMaskIndex> | null = null;
  let platesIndex: PlateMaskIndex | null = null;
  let iceLoading: Promise<IceSheetIndex> | null = null;
  let iceIndex: IceSheetIndex | null = null;
  // How far back the elevation maps reach, until their index says.
  let oldest = MAPS_REACH_MA;
  let playing = false;
  let playFrame = 0;
  let lastTick = 0;
  let head = playhead();

  function showDeepTime(state: ViewState): void {
    const { ma } = state;
    deepButton.setAttribute('aria-pressed', String(ma !== null));
    holoceneButton.setAttribute('aria-pressed', String(ma === null));
    bottom.dataset['deep'] = ma === null ? 'off' : 'on';
    paleoCredit.hidden = ma === null;
    if (ma === null) {
      stopPlay();
      deepBar.render(null);
      glance.render(null);
      globe.setUncharted(false);
      globe.setSketch(null);
      globe.setDeepTime(null);
      globe.setTemperature(null);
      globe.setShelf(null);
      globe.setIce(null);
      globe.setIceOutlines(null);
      globe.setHumanSites(null);
      globe.setSettled(null);
      globe.setFossilCells(null);
      globe.setPlates(null);
      return;
    }
    const period = periodAt(ma);
    showDeepTimeText(ma);
    // A link to before the elevation maps opens on the scale that reaches it.
    const scale = state.deepScale === 'all' && ma > oldest ? 'eons' : state.deepScale;
    const ice = scale === 'ice';
    // Before the elevation maps reach, no map: a sketch of the chosen hypotheses instead.
    const uncharted = ma > oldest;
    globe.setUncharted(uncharted);
    // Before the maps, a sketch of the hypotheses chosen; invented land only beyond the plates.
    const choices = { impact: state.impact, land: state.land, snowball: state.snowball };
    const reconstructed = ma <= (platesIndex?.frames.at(-1)?.ma ?? PLATES_REACH_MA);
    const sketch = uncharted ? sketchAt(ma, choices, reconstructed) : null;
    globe.setSketch(sketch);
    deepBar.render({
      ma,
      oldest: spanOf(scale),
      mapsReach: oldest,
      period,
      playing,
      scale,
      coastline: showCoastline(ma, state),
      ice: showIce(state, ma),
      iceOutlines: showIceOutlines(state, ma),
      plateMotion: plateMotionText(state, ma),
      humans: showHumans(state, ma),
      fossils: showFossils(state, ma),
      impacts: showImpacts(state),
      air: showAir(state),
      seaIce: showSeaIce(state, ma),
      temperature: temperatureView(state, ma),
      seaLevel: seaLevelView(state),
      ...showPlates(state, ma),
      sketch: sketch === null ? null : { sketch, choices },
    });
    glance.render({
      when: formatMa(ma),
      period: period === null ? 'Deep time' : periodWords(period),
      ma,
      oldest: spanOf(scale),
      playing,
    });
    // The temperature maps are 5 million years apart, and stop where the elevation maps do: none
    // on the ice-age scale or before them.
    showTemperature(
      ice || uncharted ? { ...state, layers: withoutTemperature(state.layers) } : state,
      ma,
    );
    paleoIndex ??= loadPaleoDemIndex(`${base}data/paleodem/index.json`, fetchJson);
    paleoIndex.then(
      (index) => {
        if (oldestMa(index) !== oldest) {
          oldest = oldestMa(index);
          showDeepTime(store.get());
          return;
        }
        if (store.get().ma !== ma) return;
        // On the ice-age scale, today's map: the next is 5 million years back.
        const { younger, older, mix } = framesAround(index.frames, ice ? 0 : ma);
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

  /** How far back each scale's time line reaches, Ma. */
  function spanOf(scale: DeepScale): number {
    if (scale === 'ice') return ICE_AGES_MA;
    return scale === 'eons' ? EARTH_AGE_MA : oldest;
  }

  function withoutTemperature(layers: ReadonlySet<Layer>): ReadonlySet<Layer> {
    const kept = new Set(layers);
    kept.delete('temperature');
    return kept;
  }

  /** The sea-level reconstructions, asked for once; null until they arrive. */
  function seaLevels(): SeaLevelIndex | null {
    if (seaLevelIndex === null && seaLevelLoading === null) {
      seaLevelLoading = loadSeaLevel(`${base}data/sealevel/index.json`, fetchJson);
      seaLevelLoading.then(
        (index) => {
          seaLevelIndex = index;
          showDeepTime(store.get());
        },
        (error: unknown) => {
          seaLevelLoading = null;
          notify(`Could not load the sea-level reconstructions: ${errorMessage(error)}`);
        },
      );
    }
    return seaLevelIndex;
  }

  function seaLevelView(state: ViewState): DeepTimeView['seaLevel'] {
    return state.layers.has('sealevel') ? { on: true, index: seaLevels() } : { on: false };
  }

  /** Today's shelves, asked for once; null until they arrive. */
  function shelves(): ShelfIndex | null {
    if (shelfIndex === null && shelfLoading === null) {
      shelfLoading = loadShelf(`${base}data/shelf/index.json`, fetchJson);
      shelfLoading.then(
        (index) => {
          shelfIndex = index;
          showDeepTime(store.get());
        },
        (error: unknown) => {
          shelfLoading = null;
          notify(`Could not load today's coasts and shelves: ${errorMessage(error)}`);
        },
      );
    }
    return shelfIndex;
  }

  /** A second reconstruction's continents, outlined, while the layer is on. */
  function showPlates(
    state: ViewState,
    ma: number,
  ): { readonly plates: boolean; readonly platesText: string | null } {
    if (!state.layers.has('plates')) {
      globe.setPlates(null);
      return { plates: false, platesText: null };
    }
    if (platesIndex === null) {
      if (platesLoading === null) {
        platesLoading = loadPlateMasks(`${base}data/plates/index.json`, fetchJson);
        platesLoading.then(
          (index) => {
            platesIndex = index;
            showDeepTime(store.get());
          },
          (error: unknown) => {
            platesLoading = null;
            notify(`Could not load the continent outlines: ${errorMessage(error)}`);
          },
        );
      }
      return { plates: true, platesText: null };
    }
    const reach = platesIndex.frames.at(-1)?.ma ?? 0;
    if (ma > reach) {
      globe.setPlates(null);
      return { plates: true, platesText: platesBeyondText(reach) };
    }
    const { younger, older, mix } = framesAround(platesIndex.frames, ma);
    globe.setPlates({
      younger: `${base}data/plates/${younger.file}`,
      older: `${base}data/plates/${older.file}`,
      mix,
      columns: platesIndex.columns,
      rows: platesIndex.rows,
      turnYounger: younger.turn ?? 0,
      turnOlder: older.turn ?? 0,
    });
    return { plates: true, platesText: plateText(mix < 0.5 ? younger : older) };
  }

  // The ice-core gases: loaded the first time the layer is turned on.
  let atmosphere: Atmosphere | null = null;
  let atmosphereLoading: Promise<Atmosphere> | null = null;

  function showAir(state: ViewState): DeepTimeView['air'] {
    if (state.deepScale !== 'ice' || !state.layers.has('air')) return { on: false };
    if (atmosphere === null && atmosphereLoading === null) {
      atmosphereLoading = loadAtmosphere(`${base}data/atmosphere.json`, fetchJson);
      atmosphereLoading.then(
        (loaded) => {
          atmosphere = loaded;
          showDeepTime(store.get());
        },
        (error: unknown) => {
          atmosphereLoading = null;
          notify(`Could not load the ice-core gases: ${errorMessage(error)}`);
        },
      );
    }
    return { on: true, atmosphere };
  }

  // Impact craters and deposits: loaded the first time the layer is turned on, in either time.
  let impacts: Impacts | null = null;
  let impactsLoading: Promise<Impacts> | null = null;
  let impactsSaid: string | null = null;

  /**
   * With Impacts on, the craters that may have struck by the moment shown, where they lay then:
   * on today's Earth in historical time, on the elevation maps' reconstruction in deep time.
   */
  function showImpacts(state: ViewState): DeepTimeView['impacts'] {
    const { ma } = state;
    const scale =
      ma !== null && state.deepScale === 'all' && ma > oldest ? 'eons' : state.deepScale;
    const on =
      state.layers.has('impacts') && state.mode === 'globe' && (ma === null || scale !== 'eons');
    if (!on) {
      impactsSaid = null;
      globe.setImpacts(null);
      return { on: false };
    }
    if (impacts === null) {
      impactsSaid = 'Loading the impact craters…';
      if (impactsLoading === null) {
        impactsLoading = loadImpacts(`${base}data/impacts.json`, fetchJson);
        impactsLoading.then(
          (loaded) => {
            impacts = loaded;
            const now = store.get();
            if (now.ma !== null) {
              showDeepTime(now);
              return;
            }
            showImpacts(now);
            showEmpires(now);
          },
          (error: unknown) => {
            impactsLoading = null;
            notify(`Could not load the impact craters: ${errorMessage(error)}`);
          },
        );
      }
      return { on: true, text: null };
    }
    if (ma === null) {
      // In historical time, today's places; a crater younger than the year shown is not there.
      const since = Math.max(0, BP_ZERO_YEAR - state.time.date.year) / 1e6;
      const marks = impactsAt(impacts, since, true);
      globe.setImpacts(marks);
      impactsSaid = impactsText(impacts, marks, null);
      return { on: true, text: impactsSaid };
    }
    // On the ice-age scale the map is today's, so the craters are where they are today.
    const marks = impactsAt(impacts, ma, false, scale === 'ice' ? 0 : ma);
    globe.setImpacts(marks);
    impactsSaid = null;
    return { on: true, text: impactsText(impacts, marks, ma) };
  }

  // Volcanic eruptions near the year shown, in historical time: loaded with the layer; each
  // volcano's summary and photo the first time a card opens.
  let volcanoes: Volcanoes | null = null;
  let volcanoesLoading: Promise<Volcanoes> | null = null;
  let volcanoesSaid: string | null = null;
  let volcanoMarks: readonly VolcanoMark[] = [];
  let volcanoDetails: VolcanoDetails | null = null;
  let volcanoDetailsLoading: Promise<VolcanoDetails> | null = null;
  let volcanoShown: VolcanoMark | null = null;

  function showVolcanoes(state: ViewState): void {
    const on = state.layers.has('volcanoes') && state.mode === 'globe' && state.ma === null;
    if (!on) {
      volcanoesSaid = null;
      volcanoMarks = [];
      globe.setVolcanoes(null);
      return;
    }
    if (volcanoes === null) {
      volcanoesSaid = 'Loading the eruptions…';
      if (volcanoesLoading === null) {
        volcanoesLoading = loadVolcanoes(`${base}data/volcanoes.json`, fetchJson);
        volcanoesLoading.then(
          (loaded) => {
            volcanoes = loaded;
            const now = store.get();
            showVolcanoes(now);
            showEmpires(now);
          },
          (error: unknown) => {
            volcanoesLoading = null;
            notify(`Could not load the eruptions: ${errorMessage(error)}`);
          },
        );
      }
      return;
    }
    const year = state.time.date.year;
    volcanoMarks = eruptionsNear(volcanoes, year);
    globe.setVolcanoes(volcanoMarks);
    volcanoesSaid = volcanoesText(volcanoMarks, year);
  }

  function showVolcanoCard(number: string): void {
    const mark = volcanoMarks.find((each) => String(each.volcano.number) === number);
    if (mark === undefined) return;
    volcanoShown = mark;
    markerCard.show(volcanoCard(mark, volcanoDetails));
    if (volcanoDetails !== null || volcanoDetailsLoading !== null) return;
    volcanoDetailsLoading = loadVolcanoDetails(`${base}data/volcano-details.json`, fetchJson);
    volcanoDetailsLoading.then(
      (loaded) => {
        volcanoDetails = loaded;
        // Its summary and photo, if its card is still the one open.
        if (markerCard.dialog.open && volcanoShown !== null) {
          markerCard.show(volcanoCard(volcanoShown, loaded));
        }
      },
      (error: unknown) => {
        volcanoDetailsLoading = null;
        notify(`Could not load the volcano’s summary: ${errorMessage(error)}`);
      },
    );
  }

  // The finds' pictures: loaded the first time a find's card opens.
  let humanPictures: Pictures | null = null;
  let humanPicturesLoading: Promise<Pictures> | null = null;
  let humanShown: string | null = null;

  function showHumanCard(id: string): void {
    if (humanClaims === null) return;
    const card = claimCard(humanClaims, id, humanPictures);
    if (card === null) return;
    humanShown = id;
    markerCard.show(card);
    if (humanPictures !== null || humanPicturesLoading !== null) return;
    humanPicturesLoading = loadPictures(`${base}data/humans/pictures.json`, fetchJson);
    humanPicturesLoading.then(
      (loaded) => {
        humanPictures = loaded;
        // Its picture, if its card is still the one open.
        const again =
          humanClaims === null || humanShown === null
            ? null
            : claimCard(humanClaims, humanShown, loaded);
        if (markerCard.dialog.open && again !== null) markerCard.show(again);
      },
      (error: unknown) => {
        humanPicturesLoading = null;
        notify(`Could not load the finds’ pictures: ${errorMessage(error)}`);
      },
    );
  }

  globe.onMarkerPick((key) => {
    const [kind, id] = key.split(':');
    volcanoShown = null;
    humanShown = null;
    if (kind === 'volcano' && id !== undefined) {
      showVolcanoCard(id);
      return;
    }
    if (kind === 'human' && id !== undefined) {
      showHumanCard(id);
      return;
    }
    if (kind === 'genome' && ancientGenomes !== null) {
      const card = genomeCellCard(ancientGenomes, Number(id), store.get().time.date.year);
      if (card !== null) markerCard.show(card);
      return;
    }
    const impact = impacts?.impacts.find((each) => String(each.id) === id);
    if (kind !== 'impact' || impact === undefined) return;
    const details = impactDetails(impact);
    markerCard.show({ title: details.title, facts: details.facts, links: [details.link] });
  });

  // Fossils: loaded the first time the layer is turned on.
  let fossils: Fossils | null = null;
  let fossilsLoading: Promise<Fossils> | null = null;

  /** On the 540 Myr span with Fossils on, the finds of the moment where they lay then. */
  function showFossils(state: ViewState, ma: number): DeepTimeView['fossils'] {
    if (state.deepScale !== 'all' || !state.layers.has('fossils')) {
      globe.setFossilCells(null);
      return { on: false };
    }
    if (fossils === null) {
      if (fossilsLoading === null) {
        fossilsLoading = loadFossils(`${base}data/fossils.json`, fetchJson);
        fossilsLoading.then(
          (loaded) => {
            fossils = loaded;
            showDeepTime(store.get());
          },
          (error: unknown) => {
            fossilsLoading = null;
            notify(`Could not load the fossils: ${errorMessage(error)}`);
          },
        );
      }
      return { on: true, at: null };
    }
    const at = fossilsAt(fossils, ma);
    globe.setFossilCells(at.cells);
    return { on: true, at };
  }

  // The curated human finds: loaded the first time the layer is turned on.
  let humanClaims: HumanClaims | null = null;
  let humanClaimsLoading: Promise<HumanClaims> | null = null;

  /** On the ice-age scale with Humans on, the finds of the moment and the claims about them. */
  function showHumans(state: ViewState, ma: number): DeepTimeView['humans'] {
    if (state.deepScale !== 'ice' || !state.layers.has('humans')) {
      globe.setHumanSites(null);
      globe.setSettled(null);
      return { on: false };
    }
    const model = showDispersal(state.dispersal, ma);
    if (humanClaims === null) {
      if (humanClaimsLoading === null) {
        humanClaimsLoading = loadHumanClaims(`${base}data/humans/claims.json`, fetchJson);
        humanClaimsLoading.then(
          (claims) => {
            humanClaims = claims;
            showDeepTime(store.get());
          },
          (error: unknown) => {
            humanClaimsLoading = null;
            notify(`Could not load the human finds: ${errorMessage(error)}`);
          },
        );
      }
      return { on: true, view: null, model };
    }
    const view = humansAt(humanClaims, ma * 1000);
    globe.setHumanSites(view.sites);
    return { on: true, view, model };
  }

  // Timmermann & Friedrich's dispersal model: its index and each scenario load when picked.
  let dispersalIndex: Promise<DispersalIndex> | null = null;
  const arrivalGrids = new Map<string, ArrivalGrid>();
  const arrivalLoading = new Set<string>();

  /** Shade the scenario picked, if any, and say what share of its land is settled then. */
  function showDispersal(
    scenario: DispersalScenario,
    ma: number,
  ): { scenario: DispersalScenario; name: string | null; share: number | null } {
    if (scenario === 'off') {
      globe.setSettled(null);
      return { scenario, name: null, share: null };
    }
    dispersalIndex ??= loadDispersalIndex(`${base}data/dispersal/index.json`, fetchJson);
    const grid = arrivalGrids.get(scenario);
    if (grid === undefined) {
      globe.setSettled(null);
      if (!arrivalLoading.has(scenario)) {
        arrivalLoading.add(scenario);
        dispersalIndex
          .then(async (index) => {
            const entry = index.scenarios.find((each) => each.id === scenario);
            if (entry === undefined) throw new Error(`no scenario ${scenario}`);
            arrivalNames.set(scenario, entry.name);
            arrivalGrids.set(
              scenario,
              await loadArrivalGrid(`${base}data/dispersal/${entry.file}`, fetchJson),
            );
            showDeepTime(store.get());
          })
          .catch((error: unknown) => {
            arrivalLoading.delete(scenario);
            notify(`Could not load the dispersal model: ${errorMessage(error)}`);
          });
      }
      return { scenario, name: null, share: null };
    }
    const ka = ma * 1000;
    globe.setSettled({ scenario, grid, ka });
    return { scenario, name: arrivalNames.get(scenario) ?? null, share: settledShare(grid, ka) };
  }
  const arrivalNames = new Map<string, string>();

  // How far the plates have moved: the file loads the first time the ice-age scale is shown.
  let plateMotion: PlateMotion | null = null;
  let plateMotionLoading: Promise<PlateMotion> | null = null;

  function plateMotionText(state: ViewState, ma: number): string | null {
    if (state.deepScale !== 'ice') return null;
    if (plateMotion === null) {
      if (plateMotionLoading === null) {
        plateMotionLoading = loadPlateMotion(`${base}data/plates-motion.json`, fetchJson);
        plateMotionLoading.then(
          (loaded) => {
            plateMotion = loaded;
            showDeepTime(store.get());
          },
          (error: unknown) => {
            plateMotionLoading = null;
            notify(`Could not load how far the plates moved: ${errorMessage(error)}`);
          },
        );
      }
      return null;
    }
    return motionText(plateMotion, ma);
  }

  // Batchelor et al.'s outlines: their file loads the first time the ice-age scale is shown.
  let iceOutlineIndex: IceOutlineIndex | null = null;
  let iceOutlinesLoading: Promise<IceOutlineIndex> | null = null;

  /** On the ice-age scale, Batchelor et al.'s outlines of the time slice shown, if any. */
  function showIceOutlines(state: ViewState, ma: number): IceOutlines | null {
    if (state.deepScale !== 'ice') {
      globe.setIceOutlines(null);
      return null;
    }
    if (iceOutlineIndex === null) {
      if (iceOutlinesLoading === null) {
        iceOutlinesLoading = loadIceOutlines(`${base}data/icesheets/batchelor.json`, fetchJson);
        iceOutlinesLoading.then(
          (index) => {
            iceOutlineIndex = index;
            showDeepTime(store.get());
          },
          (error: unknown) => {
            iceOutlinesLoading = null;
            notify(`Could not load the ice-sheet outlines: ${errorMessage(error)}`);
          },
        );
      }
      return null;
    }
    const outlines = iceOutlinesAt(iceOutlineIndex, ma * 1000);
    globe.setIceOutlines(outlines);
    return outlines;
  }

  /** On the ice-age scale, the ice sheets of the moment, where the maps reach. */
  function showIce(state: ViewState, ma: number): DeepTimeView['ice'] {
    if (state.deepScale !== 'ice') {
      globe.setIce(null);
      return { drawn: false, oldestKa: null, standIn: null };
    }
    if (iceIndex === null) {
      if (iceLoading === null) {
        iceLoading = loadIceSheets(`${base}data/icesheets/index.json`, fetchJson);
        iceLoading.then(
          (index) => {
            iceIndex = index;
            showDeepTime(store.get());
          },
          (error: unknown) => {
            iceLoading = null;
            notify(`Could not load the ice-sheet maps: ${errorMessage(error)}`);
          },
        );
      }
      return { drawn: false, oldestKa: null, standIn: null };
    }
    const oldestKa = oldestIceKa(iceIndex);
    if (ma * 1000 > oldestKa) {
      const standIn = iceStandInFor(state, ma, iceIndex);
      globe.setIce(
        standIn === null
          ? null
          : {
              younger: `${base}data/icesheets/${standIn.file}`,
              older: `${base}data/icesheets/${standIn.file}`,
              mix: 0,
              columns: iceIndex.columns,
              rows: iceIndex.rows,
              metresPerStep: iceIndex.metresPerStep,
            },
      );
      return { drawn: standIn !== null, oldestKa, standIn };
    }
    const { younger, older, mix } = framesAround(iceFramesInMa(iceIndex), ma);
    globe.setIce({
      younger: `${base}data/icesheets/${younger.file}`,
      older: `${base}data/icesheets/${older.file}`,
      mix,
      columns: iceIndex.columns,
      rows: iceIndex.rows,
      metresPerStep: iceIndex.metresPerStep,
    });
    return { drawn: true, oldestKa, standIn: null };
  }

  // Sea ice: its index loads the first time the ice-age scale is shown.
  let seaIceIndex: SeaIceIndex | null = null;
  let seaIceLoading: Promise<SeaIceIndex> | null = null;

  /** On the ice-age scale, sea ice blended from today's towards the chosen model's. */
  function showSeaIce(state: ViewState, ma: number): SeaIceView | null {
    if (state.deepScale !== 'ice') {
      globe.setSeaIce(null);
      return null;
    }
    if (seaIceIndex === null) {
      if (seaIceLoading === null) {
        seaIceLoading = loadSeaIce(`${base}data/seaice/index.json`, fetchJson);
        seaIceLoading.then(
          (index) => {
            seaIceIndex = index;
            showDeepTime(store.get());
          },
          (error: unknown) => {
            seaIceLoading = null;
            notify(`Could not load the sea-ice maps: ${errorMessage(error)}`);
          },
        );
      }
      return { model: state.seaIce, mix: null };
    }
    const pair = seaIcePair(seaIceIndex, state.seaIce);
    const levels = seaLevels();
    const now = levels === null ? null : coastlineAt(levels, state.coast, ma * 1000);
    if (pair === null || levels === null || now === null) {
      globe.setSeaIce(null);
      return { model: state.seaIce, mix: null };
    }
    // How far the sea had fallen towards its glacial low, by the same source.
    const source: CoastSource = COAST_SOURCES.find((id) => id === now.series.id) ?? state.coast;
    const glacial = coastlineAt(levels, source, LAST_GLACIAL_MAXIMUM_MA * 1000);
    const mix = seaIceMix(now.seaLevel, glacial?.seaLevel ?? -120);
    const folder = `${base}data/seaice/`;
    globe.setSeaIce({
      todayMost: folder + pair.today.most,
      todayYearRound: folder + pair.today.yearRound,
      pastMost: folder + pair.past.most,
      pastYearRound: folder + pair.past.yearRound,
      mix,
      columns: seaIceIndex.columns,
      rows: seaIceIndex.rows,
    });
    return { model: state.seaIce, mix };
  }

  /** Before the ice maps reach: the map whose sea level, by the coastline's source, matches. */
  function iceStandInFor(state: ViewState, ma: number, index: IceSheetIndex): IceStandIn | null {
    const levels = seaLevels();
    if (levels === null) return null;
    const now = coastlineAt(levels, state.coast, ma * 1000);
    if (now === null) return null;
    // The same source throughout, so the levels compare like with like.
    const source: CoastSource = COAST_SOURCES.find((id) => id === now.series.id) ?? state.coast;
    return iceStandIn(
      index,
      now.seaLevel,
      (ka) => coastlineAt(levels, source, ka)?.seaLevel ?? null,
    );
  }

  /**
   * Over the ice ages, on either scale, coastlines from NOAA's present-day depths at the sea
   * level of the moment, by the source chosen: the elevation maps' 8-bit heights cannot tell a
   * strait a few metres deep from land.
   */
  function showCoastline(ma: number, state: ViewState): CoastlineView | null {
    if (ma > ICE_AGES_MA) {
      globe.setShelf(null);
      return null;
    }
    const levels = seaLevels();
    const coastline = levels === null ? null : coastlineAt(levels, state.coast, ma * 1000);
    const shelf = shelves();
    globe.setShelf(
      coastline === null || shelf === null
        ? null
        : {
            url: `${base}data/shelf/${shelf.file}`,
            columns: shelf.columns,
            rows: shelf.rows,
            lowest: shelf.lowest,
            highest: shelf.highest,
            seaLevel: coastline.seaLevel,
          },
    );
    return {
      coast: state.coast,
      seaLevel: coastline?.seaLevel ?? null,
      label: coastline?.series.label ?? null,
      instead: coastline?.instead?.label ?? null,
    };
  }

  /** What the bar says about temperature: off, loading, or the global mean then and now. */
  /** Every temperature model's maps, each asked for once; null until it arrives. */
  function temperatureIndexes(): TemperatureIndexes {
    for (const model of TEMPERATURE_MODELS) {
      if (tempIndexes[model] !== null || tempLoading[model] !== null) continue;
      const loading = loadPaleoTempIndex(
        `${base}data/${TEMPERATURE_MODEL_FOLDERS[model]}/index.json`,
        fetchJson,
      );
      tempLoading = { ...tempLoading, [model]: loading };
      loading.then(
        (index) => {
          tempIndexes = { ...tempIndexes, [model]: index };
          showDeepTime(store.get());
        },
        (error: unknown) => {
          tempLoading = { ...tempLoading, [model]: null };
          notify(
            `Could not load the ${TEMPERATURE_MODEL_LABELS[model]} temperature maps: ${errorMessage(error)}`,
          );
        },
      );
    }
    return tempIndexes;
  }

  /** What the bar says about temperature: every model's global mean, and which one is drawn. */
  function temperatureView(state: ViewState, ma: number): TemperatureView {
    const wanted = state.temperatureModel;
    if (!state.layers.has('temperature')) {
      return { on: false, wanted, shown: null, readings: [], note: null };
    }
    const indexes = temperatureIndexes();
    const readings = TEMPERATURE_MODELS.flatMap((model) => {
      const index = indexes[model];
      if (index === null) return [];
      return [
        {
          model,
          mean: meanAt(index, ma),
          today: index.frames[0]?.mean ?? null,
          reach: reachMa(index),
        },
      ];
    });
    const drawn = mapModel(wanted, indexes, ma);
    const index = drawn === null ? null : indexes[drawn.model];
    let note: string | null = null;
    if (index !== null) {
      // The note of the map nearer the moment, if it has one.
      const { younger, older, mix } = framesAround(index.frames, ma);
      note = (mix < 0.5 ? younger : older).note ?? null;
    }
    return { on: true, wanted, shown: drawn?.model ?? null, readings, note };
  }

  function showTemperature(state: ViewState, ma: number): void {
    if (!state.layers.has('temperature')) {
      globe.setTemperature(null);
      return;
    }
    const indexes = temperatureIndexes();
    const drawn = mapModel(state.temperatureModel, indexes, ma);
    const index = drawn === null ? null : indexes[drawn.model];
    if (drawn === null || index === null) return;
    const folder = TEMPERATURE_MODEL_FOLDERS[drawn.model];
    const { younger, older, mix } = framesAround(index.frames, ma);
    globe.setTemperature({
      younger: `${base}data/${folder}/${younger.file}`,
      older: `${base}data/${folder}/${older.file}`,
      mix,
      columns: index.columns,
      rows: index.rows,
      coldest: index.coldest,
      warmest: index.warmest,
    });
  }

  /** The header in deep time: how long ago, and the period by the ICS chart. */
  function showDeepTimeText(ma: number): void {
    const period = periodAt(ma);
    dateText.textContent = formatMa(ma);
    timeText.textContent = '';
    detailText.textContent = period === null ? 'Deep time' : periodWords(period);
  }

  /** Play towards the present; from today, start again at the oldest map. */
  function startPlay(): void {
    if (playing) return;
    playing = true;
    if ((store.get().ma ?? 0) <= 0) {
      store.set((state) => ({ ...state, ma: spanOf(state.deepScale) }));
    }
    lastTick = performance.now();
    head = playhead();
    playFrame = requestAnimationFrame(tick);
    showDeepTime(store.get());
  }

  function tick(now: number): void {
    const seconds = (now - lastTick) / 1000;
    lastTick = now;
    const ma = store.get().ma;
    if (ma === null) {
      stopPlay();
      return;
    }
    const scale = store.get().deepScale;
    const speed =
      scale === 'ice'
        ? ICE_PLAY_MA_PER_SECOND
        : scale === 'eons'
          ? EONS_PLAY_MA_PER_SECOND
          : PLAY_MA_PER_SECOND;
    const next = head.step(ma, speed, seconds);
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

  // Ancient genomes: their file loads the first time the layer is turned on.
  let ancientGenomes: AncientGenomes | null = null;
  let ancientGenomesLoading: Promise<AncientGenomes> | null = null;
  let genomesSaid: string | null = null;

  /** In historical time with the layer on, the regions with genomes dated near the year. */
  function showGenomes(state: ViewState): void {
    const on = state.layers.has('genomes') && state.ma === null;
    genomeCredit.hidden = !on;
    if (!on) {
      genomesSaid = null;
      globe.setGenomeCells(null);
      return;
    }
    if (ancientGenomes === null) {
      genomesSaid = 'Loading the ancient genomes…';
      if (ancientGenomesLoading === null) {
        ancientGenomesLoading = loadAncientGenomes(`${base}data/genomes/aadr.json`, fetchJson);
        ancientGenomesLoading.then(
          (data) => {
            ancientGenomes = data;
            showGenomes(store.get());
            showEmpires(store.get());
          },
          (error: unknown) => {
            ancientGenomesLoading = null;
            notify(`Could not load the ancient genomes: ${errorMessage(error)}`);
          },
        );
      }
      return;
    }
    const near = genomesNear(ancientGenomes, state.time.date.year);
    genomesSaid = genomesNote(near);
    globe.setGenomeCells(near.cells);
  }

  // Rocks at the surface: their file loads the first time the layer is turned on.
  let rocks: readonly RockUnit[] | null = null;
  let rocksLoading: Promise<Rocks> | null = null;
  let rocksSaid: string | null = null;
  let rocksAction: { readonly label: string; readonly run: () => void } | null = null;

  /** In historical time with the layer on, the rocks by age, and the rock at the place picked. */
  function showRocks(state: ViewState): void {
    const on = state.layers.has('rocks') && state.ma === null;
    rocksCredit.hidden = !on;
    rocksAction = null;
    if (!on) {
      rocksSaid = null;
      globe.setRocks(null);
      return;
    }
    if (rocks === null) {
      rocksSaid = 'Loading the rocks…';
      if (rocksLoading === null) {
        rocksLoading = loadRocks(`${base}data/rocks.json`, fetchJson);
        rocksLoading.then(
          (data) => {
            rocks = rockUnits(data);
            showRocks(store.get());
            showEmpires(store.get());
          },
          (error: unknown) => {
            rocksLoading = null;
            notify(`Could not load the rocks: ${errorMessage(error)}`);
          },
        );
      }
      return;
    }
    globe.setRocks(rocks);
    const rock = state.location === null ? null : rockAt(rocks, state.location);
    rocksSaid =
      state.location === null
        ? 'Pick a place on the globe to see its rock, and when it formed.'
        : rockText(rock);
    if (rock !== null) {
      // The middle of the rock's age range, on the span that reaches it.
      const ma = (rock.topMa + rock.bottomMa) / 2;
      const scale: DeepScale = ma <= ICE_AGES_MA ? 'ice' : ma <= oldest ? 'all' : 'eons';
      rocksAction = {
        label: `See the Earth as it was then, ${formatMa(ma)}`,
        run: () => {
          enterDeepTime(ma, scale);
        },
      };
    }
  }

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
    periodsCredit.hidden = !on;
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
            showEmpires(store.get());
          },
          (error: unknown) => {
            namedPeriodsLoading = null;
            notify(`Could not load the named periods: ${errorMessage(error)}`);
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

  // Ways of life: their file loads the first time the layer is turned on.
  let waysOfLife: WaysOfLife | null = null;
  let waysLoading: Promise<WaysOfLife> | null = null;
  let waysSaid: string | null = null;

  /** In historical time with the layer on, the regions by their most widespread way of life. */
  function showWays(state: ViewState): void {
    const on = state.layers.has('ways') && state.ma === null;
    waysCredit.hidden = !on;
    if (!on) {
      waysSaid = null;
      waysShownYear = null;
      globe.setWays(null);
      return;
    }
    if (waysOfLife === null) {
      waysSaid = 'Loading the ways of life…';
      if (waysLoading === null) {
        waysLoading = loadWaysOfLife(`${base}data/ways-of-life.json`, fetchJson);
        waysLoading.then(
          (data) => {
            waysOfLife = data;
            showWays(store.get());
            showEmpires(store.get());
          },
          (error: unknown) => {
            waysLoading = null;
            notify(`Could not load the ways of life: ${errorMessage(error)}`);
          },
        );
      }
      return;
    }
    const at = waysAt(waysOfLife, state.time.date.year);
    waysSaid = waysNote(at, (year) => formatYear(astronomicalYear(year)));
    // Repainting the map is slow: only when the moment rated changes, as the years go by.
    if (at.year === waysShownYear) return;
    waysShownYear = at.year;
    globe.setWays(at.regions);
  }
  let waysShownYear: number | null = null;

  function showEmpires(state: ViewState): void {
    // Past states belong to historical time, not deep time.
    const on = state.layers.has('empires') && state.ma === null;
    layersPanel.render({
      layers: state.layers,
      borders: state.borders,
      year: state.time.date.year,
      present: PRESENT_YEAR,
      visible: state.mode === 'globe' && state.ma === null,
      said: new Map<Layer, string>([
        ...(genomesSaid === null ? [] : [['genomes', genomesSaid] as const]),
        ...(waysSaid === null ? [] : [['ways', waysSaid] as const]),
        ...(periodsSaid === null ? [] : [['periods', periodsSaid] as const]),
        ...(rocksSaid === null ? [] : [['rocks', rocksSaid] as const]),
        ...(impactsSaid === null ? [] : [['impacts', impactsSaid] as const]),
        ...(volcanoesSaid === null ? [] : [['volcanoes', volcanoesSaid] as const]),
      ]),
      actions: new Map(rocksAction === null ? [] : [['rocks', rocksAction] as const]),
    });
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
        : empireCenturyFor(year).then((file) =>
            file === null ? [] : territoriesIn(file, cliopatriaYear(year, PRESENT_YEAR)),
          );
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
        noteStates(year, [
          ...drawn.map(({ name }) => name),
          ...(lines?.labels ?? []).map(({ name }) => name),
        ]);
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
      map: { small: `${base}${image.map['512']}`, large: `${base}${image.map['4096']}` },
      disc: { small: `${base}${image.disc['512']}`, large: `${base}${image.disc['2048']}` },
      // Visible light comes as grey; the Sun's own light is a warm white.
      tint: image.key === 'visible' ? [1, 0.93, 0.8] : [1, 1, 1],
      diskRadius: sunImages.diskRadius,
      // The map is the surface seen face-on; in visible light it darkens toward the limb, as
      // the Sun does seen by eye.
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
  /** The name of where the observer stands: a famous eclipse's place, or a culture's site. */
  function placeName(place: GeoPoint, famousHere: FamousEclipse | undefined): string | null {
    const record = famousHere?.place;
    if (
      record !== undefined &&
      Math.abs(record.latitude - place.latitude) < 0.01 &&
      Math.abs(record.longitude - place.longitude) < 0.01
    ) {
      return record.name;
    }
    return namedPlace(place);
  }

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
  // Checking a tablet needs the Moon, the planets and the stars; they load the first time.
  const RECORD_FOV = 40;
  let tabletSkyLoading: Promise<TabletSky> | null = null;
  function tabletSky(): Promise<TabletSky> {
    tabletSkyLoading ??= Promise.all([
      moonEphemeris === null ? loadMoonEphemeris() : Promise.resolve(moonEphemeris),
      loadPlanets(),
      loadSky(`${base}data/sky.json`, (url) => fetch(url)),
    ]).then(([moon, planetTheory, catalogue]) => ({
      moon,
      planets: planetTheory,
      stars: starsByNumber(catalogue.stars),
      deltaT: (jd) => deltaT.seconds(jd),
      place: BABYLON,
    }));
    tabletSkyLoading.catch(() => {
      tabletSkyLoading = null;
    });
    return tabletSkyLoading;
  }

  /** Stand in Babylon at the moment of a tablet's record, facing what it describes. */
  // The record shown in the sky, with its bodies pointed out; cleared on leaving Babylon's sky.
  let recordShown: { readonly verdict: Verdict; readonly sky: TabletSky } | null = null;
  recordBack.addEventListener('click', () => {
    const id = recordShown?.verdict.observation.id;
    tabletPanel.open();
    if (id !== undefined) {
      const row = tabletPanel.dialog.querySelector<HTMLElement>(`[data-record="${id}"]`);
      row?.scrollIntoView({ block: 'center' });
      row?.focus();
    }
  });
  recordClose.addEventListener('click', () => {
    clearRecord();
  });

  function clearRecord(): void {
    recordShown = null;
    recordBanner.hidden = true;
    skyScene?.setMarks([]);
  }

  /** The bodies the record names, where they stand from Babylon at the moment shown. */
  function recordMarks(state: ViewState): readonly SkyMark[] {
    if (recordShown === null) return [];
    const { sky, verdict } = recordShown;
    const jdUT = momentJulianDay(state.time);
    const jdTT = julianDayNumber(jdUT + deltaT.seconds(jdUT) / 86_400);
    const horizon = horizonMatrix(BABYLON, jdUT, jdTT);
    return recordBodies(verdict.observation).map((body) => ({
      name: bodyName(body),
      ...horizontalOf(horizon, directionOf(sky, body, jdUT)),
    }));
  }

  async function goToRecord(verdict: Verdict): Promise<void> {
    const sky = await tabletSky();
    const moment = verdictMoment(sky, verdict);
    if (moment === null) return;
    const { observation } = verdict;
    recordShown = { verdict, sky };
    recordText.textContent = `${observation.line}: ${observation.text}`;
    recordMark.className = `tablet-mark ${verdict.fits ? 'fits' : 'misses'}`;
    recordMark.textContent = verdict.fits
      ? `✓ fits: computed ${computedText(verdict)}`
      : `✗ does not fit: computed ${computedText(verdict)}`;
    recordBanner.hidden = false;
    const body = observation.kind === 'position' ? observation.body : 'moon';
    const jdTT = julianDayNumber(moment + deltaT.seconds(moment) / 86_400);
    const { azimuth, altitude } = horizontalOf(
      horizonMatrix(BABYLON, moment, jdTT),
      directionOf(sky, body, moment),
    );
    store.set((state) => ({
      ...state,
      mode: 'sky',
      ma: null,
      years: 'babylonian',
      location: BABYLON,
      time: momentAt(moment),
      // Aim at the body: the sky centres it in the space the panels leave.
      look: roundLook({ azimuth, altitude: Math.max(LOWEST_LOOK, altitude), fov: RECORD_FOV }),
    }));
  }

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
    skyOptions.hidden = !inSky;
    skyEclipse.hidden = true;
    figureSwitch.render(state.figures, inSky, state.culture === 'modern');
    cultureSwitch.render(state.culture, inSky);
    aimSwitch.render(inSky, moonEphemeris !== null);
    const atBabylon =
      state.location !== null &&
      state.location.latitude === BABYLON.latitude &&
      state.location.longitude === BABYLON.longitude;
    if (recordShown !== null && (!inSky || !atBabylon)) clearRecord();
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
    skyScene.setMarks(recordMarks(state));
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
    const leftDeepTime = previous !== null && previous.ma !== null && state.ma === null;
    if (state.time !== previous?.time || state.years !== previous.years || leftDeepTime) {
      showTime(state);
    }
    if (
      state.ma !== previous?.ma ||
      state.time !== previous.time ||
      state.years !== previous.years ||
      state.layers !== previous.layers ||
      state.deepScale !== previous.deepScale ||
      state.coast !== previous.coast ||
      state.seaIce !== previous.seaIce ||
      state.temperatureModel !== previous.temperatureModel ||
      state.dispersal !== previous.dispersal ||
      state.impact !== previous.impact ||
      state.land !== previous.land ||
      state.snowball !== previous.snowball
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
      state.time.date.year !== previous.time.date.year ||
      state.location !== previous.location
    ) {
      showGenomes(state);
      showWays(state);
      showRocks(state);
      showPeriods(state);
      showImpacts(state);
      showVolcanoes(state);
      showEmpires(state);
    }
    // Deep time, or an eclipse picked, ends a trip through the years.
    if (state.ma !== null || state.selection !== null) stopHistory();
    if (state.time.date.year !== previous?.time.date.year || state.layers !== previous.layers) {
      showHistory(state);
    }
    if (state.location !== previous?.location) globe.setLocation(state.location);
    if (state.view !== previous?.view) globe.setViewpoint(state.view);
    if (state.view !== previous?.view || state.mode !== previous.mode) {
      viewSwitch.render(state.mode, state.view, moonEphemeris !== null);
    }
    if (state.years !== previous?.years || barYear(state) !== barYear(previous)) {
      loadYear(state);
    }
    // Tablets are dated in the Babylonian calendar: their check shows with it.
    tabletPanel.button.hidden = state.years !== 'babylonian';
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
    // Once the visitor picks an eclipse, a place, a view or deep time, they have found the way in.
    if (
      state.selection !== previous.selection ||
      state.location !== previous.location ||
      state.mode !== previous.mode ||
      state.view !== previous.view ||
      state.ma !== previous.ma
    ) {
      welcome.dismiss();
    }
  });
  render(store.get(), null);
  // Write the canonical, fully explicit URL straight away so it can be shared as is.
  sync.flush();

  // Keep the globe centred in the space the panels leave free. The date panel counts when it
  // spans most of the width (on phones, and on wide screens once it fills with controls); a
  // narrow one sits beside the globe.
  const top = root.querySelector('.hud');
  if (top !== null) {
    const update = (): void => {
      const spans = top.getBoundingClientRect().width > window.innerWidth * 0.55;
      panelInsets = {
        top: spans ? top.getBoundingClientRect().bottom : 0,
        bottom: bottom.getBoundingClientRect().height,
      };
      globe.setInsets(panelInsets.top, panelInsets.bottom);
      skyScene?.setInsets(panelInsets.top, panelInsets.bottom);
    };
    const observer = new ResizeObserver(update);
    observer.observe(top);
    observer.observe(bottom);
    window.addEventListener('resize', update);
  }

  globe.onBodyClick((focus) => {
    store.set((state) => ({ ...state, focus, view: 'free' }));
  });
  globe.onEmptyTap(showPanels);
  globe.onPlacePick((place) => {
    // Deep time has no place to stand: a tap on the globe clears the panels, or brings them back.
    if (store.get().ma !== null) {
      togglePanels();
      return;
    }
    const location = { latitude: round(place.latitude, 4), longitude: round(place.longitude, 4) };
    // During a solar eclipse, show the moment it is deepest at the place picked.
    const selected = selectedEclipse(store.get());
    store.set((state) => ({
      ...state,
      location,
      time:
        selected === undefined || !isSolar(selected)
          ? state.time
          : eclipseMomentAt(selected, location),
    }));
  });
  globe.onCameraChange((camera) => {
    store.set((state) => ({ ...state, camera }));
  });
  window.addEventListener('pagehide', () => {
    sync.flush();
  });
  // Back and Forward: show the view the address bar now describes, without writing it again.
  window.addEventListener('popstate', () => {
    const restored = parseViewState(window.location.search, new Date()).state;
    sync.adopt(restored);
    store.set(() => restored);
  });
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
