/**
 * Wires the view state (from the URL) to the globe, the timeline, the scrubber and the card.
 * Browser-only glue, covered by the Playwright suite. Logic worth unit testing lives in the
 * modules it calls.
 */

import { loadMoonEphemeris, type MoonEphemeris } from './astro/moon';
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
import { angularDistance, longitudeUncertainty, shiftLongitude } from './eclipses/visibility';
import { impactLayer } from './globe/impactLayer';
import { dateCellsLayer, rocksLayer, waysLayer } from './globe/historyPaintLayers';
import { iceOutlineLayer } from './globe/iceOutlineLayer';
import { magneticNorthLayer } from './globe/magneticNorthLayer';
import { geoToVector } from './globe/geo';
import { PLANET_NAMES } from './globe/planetLook';
import { loadPolarity, type PolarityScale } from './data/polarity';
import { magneticNorthAt } from './deepTime/earthState';
import { loadRadiocarbon, type Radiocarbon } from './data/radiocarbon';
import { DATABLE_YEARS } from './data/radiocarbonProduction';
import {
  datesHere,
  datesNear,
  datesNote,
  loadDatesHeat,
  loadDatesTile,
  tileKeyOf,
  type DatesHeat,
  type DatesTile,
} from './data/radiocarbonDates';
import { eruptionsBetween, loadEruptions, type Eruptions } from './data/eruptions';
import { dipoleAt, loadDipole, type DipoleSeries } from './data/dipoleMoment';
import type { ShowerState } from './globe/showerAnimation';
import { captionOf, landing, SHOWER_STORY, SUN_STORY, type ShowerStep } from './globe/showerSteps';
import type { AirShower } from './story/airShower';
import type { LeafScene } from './story/leafScene';
import type { SunCore } from './story/sunCore';
import { createShowerStage } from './ui/showerStage';
import { onLand, type ElevationGrid } from './data/landSea';
import { loadElevationGrid } from './ui/elevationImage';
import { RADIOCARBON_EVENTS } from './data/radiocarbonEvents';
import { createDatingCard } from './ui/datingCard';
import {
  createCarbonMadeCard,
  glowOf,
  THEN_ID,
  THEN_UNKNOWN,
  thenField,
} from './ui/carbonMadeCard';
import { createRadiocarbonStrip } from './ui/radiocarbonStrip';
import { createGlobe, type StateChange } from './globe/scene';
import {
  DEEP_TIME,
  EARTH_LAYERS,
  FOUND_THE_WAY_IN,
  HISTORY,
  redraws,
  SELECTION,
  SKY,
  VIEW_SWITCH,
} from './state/redraws';
import { changed, createStore } from './state/store';
import { parseViewState, serializeViewState } from './state/url';
import { browserUrlWriter, createUrlSync } from './state/urlSync';
import {
  awayFromEarth,
  DEFAULT_CAMERA,
  DEFAULT_LOOK,
  defaultViewState,
  type DeepScale,
  EARTH_AGE_MA,
  ICE_AGES_MA,
  LAST_GLACIAL_MAXIMUM_MA,
  type BorderSource,
  type Layer,
  withLayer,
  roundMa,
  momentJulianDay,
  type GeoPoint,
  type ViewState,
} from './state/viewState';
import { type PlanetName } from './astro/planets';
import { observerPosition } from './sky/bodies';
import { longTermEarthFixedToJ2000 } from './astro/longTermPrecession';
import { DeltaT } from './time/deltaT';
import { formatCalendar, formatDate, formatDuration, formatTimeOfDay } from './time/format';
import {
  calendarDate,
  historicalCalendar,
  julianDayNumber,
  type JulianDay,
} from './time/julianDay';
import { formatInCalendar, shortDate, yearContaining, yearSpan } from './time/calendars';
import { astronomicalYear, formatYear, type AstronomicalYear } from './time/year';
import { moveToYear } from './time/yearInput';
import { element } from './ui/dom';
import { createEclipseCard } from './ui/eclipseCard';
import { FEATURES } from './features';
import { RESTING, type DeepMoment, type FeatureContext } from './features/feature';
import { isMoonBody, moonPlanet } from './globe/moonLook';
import { createCycleTrack, type CycleMoment, type CycleSpeed } from './ui/cycleTrack';
import { planetCycle, sunCycle, type BodyCycle } from './astro/planetCycle';
import { createFamousPanel } from './ui/famousPanel';
import { createSearchPanel } from './ui/searchPanel';
import { anchorLabel, anchorQuery } from './text/anchors';
import { loadMeaningSearch } from './text/meaningLoader';
import { nearby } from './text/nearby';
import { cachedPassages, type Anchor, type Passage } from './text/passages';
import { indexPassages } from './text/wordSearch';
import { uiIcon } from './ui/icons';
import { createWelcome } from './ui/welcome';
import { loadSeaIce, type SeaIceIndex, seaIceMaps, seaIceMix, seaIceSeason } from './data/seaIce';
import { createMarkerCard } from './ui/markerCard';
import { createScrubber, SCRUB_RANGE_MINUTES } from './ui/scrubber';
import { createLayersPanel } from './ui/layersPanel';
import { createDeepGlance } from './ui/deepGlance';
import { CARBON_LIMIT, cliopatriaYear, LAYER_GROUPS } from './state/layerCatalog';
import {
  blankText,
  changesText,
  createHistoryTrack,
  earthText,
  STATES_HINT,
  STATES_WAIT,
} from './ui/historyTrack';
import { yearPlayhead, type YearSpeed } from './time/yearPlay';
import {
  centuryFor,
  labelPoint,
  loadEmpireCentury,
  loadEmpireIndex,
  stateChanges,
  stateChangesOnMap,
  type NamedPoint,
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
import { CULTURE_INFO } from './data/skyCultures';
import { createViewSwitch } from './ui/viewSwitch';
import {
  type CoastlineView,
  createDeepTimeBar,
  type DeepTimeView,
  type SeaIceView,
} from './ui/deepTimeBar';
import type { DeepChipView } from './ui/deepChips';
import { formatMa, periodAt, periodWords } from './deepTime/periods';
import {
  framesAhead,
  framesAround,
  loadPaleoDemIndex,
  oldestMa,
  type PaleoDemIndex,
} from './data/paleoDem';
import { loadSeaLevel, type SeaLevelIndex } from './data/seaLevel';
import {
  iceFramesInMa,
  iceStandIn,
  type IceStandIn,
  HOLOCENE_MA,
  kaBeforePresent,
  loadIceSheets,
  maOfYear,
  oldestIceKa,
  type IceSheetIndex,
  yearOfMa,
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
import { browserTimeZone, leavesViewOpen, loadTimeZones, placeOfZone } from './data/timezones';
import { approachOf, impactorText } from './data/impactScaling';
import { createWhySheet, type HereView, type WhyMoment } from './ui/whySheet';
import { createImpactPathsSheet } from './ui/impactPathsSheet';
import { createBoundariesSheet } from './ui/boundariesSheet';
import type { PartContext } from './features/part';
import { mountTreeOfLife } from './features/treeOfLife';
import { mountSky } from './features/sky';
import { mountBodies } from './features/bodies';
import { mountRecords } from './features/records';
import { phoneLook, type BodiesSeen } from './sky/aim';
import { PERIOD_EVIDENCE } from './sources/periodEvidence';
import { hereFacts, placeText } from './sources/here';
import { layerWhy, onScreen, type WhyId } from './sources/registry';
import { createZoomRail } from './ui/zoomRail';
import { createWaysLegend } from './ui/waysLegend';
import { loadWaysOfLife, waysAt, waysNote, type WaysOfLife } from './data/waysOfLife';
import { loadAtmosphere, type Atmosphere } from './data/atmosphere';
import { loadCo2Archive, type Co2Archive } from './data/co2Archive';
import { loadDeepAir, type DeepAir } from './data/deepAir';
import {
  impactDetails,
  impactsAt,
  impactsText,
  placeThen,
  loadImpacts,
  strikesPassed,
  type Impact,
  type Impacts,
  type ImpactsMode,
} from './data/impacts';
import {
  loadPlateMasks,
  type PlateMaskIndex,
  platesBeyondText,
  plateText,
} from './data/plateMasks';
import { loadShelf, type ShelfIndex } from './data/shelf';
import { deepSpeedFor, prefetchFrames } from './deepTime/playSpeed';
import { COAST_SOURCES, coastlineAt, type Coastline, type CoastSource } from './deepTime/coastline';
import { createTemperatureLayer } from './features/temperature/temperatureLayer';
import { playhead } from './deepTime/playhead';
import { PLATES_REACH_MA, sketchAt } from './deepTime/sketch';
import { createTimeline, type Eclipse, type SeenView, type YearEclipses } from './ui/timeline';
import { createPeriodBands, yearTicks } from './ui/periodBands';
import { createSpanSwitch, type Span } from './ui/spanSwitch';
import { errorMessage } from './util/errors';

const MINUTES_PER_DAY = 1440;
/** Degrees from the centre of the globe in view within which a strike is played as time runs. */
const STRIKE_IN_VIEW = 70;
/** Strikes started in one frame at most, the greatest first, when time runs fast past several. */
const STRIKES_AT_ONCE = 4;
/** Pixels the zoom rail needs between the panels: its buttons, a short track and its reading. */
const ZOOM_RAIL_ROOM = 180;
/** This year, up to which the latest borders of states carry on. */
const PRESENT_YEAR = new Date().getUTCFullYear();
/** The year “before present” counts back from, as radiocarbon dates do. */
const BP_ZERO_YEAR = 1950;

/** The elevation maps reach back this far (their index says for certain once loaded). */
const MAPS_REACH_MA = 540;

export async function startApp(root: HTMLElement): Promise<void> {
  const base = import.meta.env.BASE_URL;
  const now = new Date();
  // The link as the reader opened it, before the view is written back into it.
  const openedSearch = window.location.search;
  const parsed = parseViewState(openedSearch, now);
  const store = createStore<ViewState>(parsed.state);
  const fetchJson = (url: string): Promise<Response> => fetch(url);

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
      records.open();
    },
  );
  const viewSwitch = createViewSwitch((choice) => {
    if (choice === 'sky') {
      // Stand where the link says, or else on the spot in the middle of the globe; during an
      // eclipse, face it.
      store.set((state) => {
        // The sky is drawn for historical time: leaving for it leaves deep time too.
        const next: ViewState = {
          ...state,
          mode: 'sky',
          location: observerOf(state),
          ma: null,
          look: phoneLook(state.look, DEFAULT_LOOK, window.innerHeight > window.innerWidth),
        };
        const selected = selectedEclipse(state);
        if (selected === undefined) return next;
        const look = sky.aimAt(next, isSolar(selected) ? 'sun' : 'moon');
        return look === null || look.altitude <= -1 ? next : { ...next, look };
      });
    } else {
      store.set((state) => ({ ...state, mode: 'globe', view: choice }));
    }
  });
  // The orbits, offered where they mean something: far out, or on the Sun or a planet.
  // Why anything is on screen: the book marks beside things, and the panel they open.
  // The panel follows the view, so the link names the why open and opens it again.
  const whySheet = createWhySheet(
    (why) => {
      // Closing "Here" by hand leaves the asking too.
      if (why === null) askingHere = false;
      store.set((state) => ({ ...state, why }));
    },
    () => hereView(store.get()),
    (id) => whyMoment(id, store.get()),
  );
  // What the app lends the parts of the page (#443).
  const partContext: PartContext = {
    base,
    fetchJson,
    store,
    notify,
    why: (id, label) => whySheet.mark(id, label),
    goToDeepTime(ma, layer, where) {
      enterDeepTime(ma, 'all');
      // The layer on to mark it, and the globe turned to face it where it lay then.
      store.set((state) => ({ ...state, layers: withLayer(state.layers, layer, true) }));
      globe.flyTo(where);
    },
  };
  // The planetary boundaries' story (#434): its data and scene load when it first opens.
  const boundariesSheet = createBoundariesSheet(
    (boundaries) => {
      store.set((state) => ({ ...state, boundaries }));
    },
    (file) => `${base}data/${file}`,
    (url) => fetch(url),
    `${base}textures/earth-blue-marble-2048.jpg`,
    whySheet.mark('boundaries', 'Planetary boundaries'),
  );
  // The tree of life and life through time: their sheets, and the ways to open them.
  const treeOfLife = mountTreeOfLife(partContext);
  // The sky view (#448): loaded the first time it is opened.
  const sky = mountSky({
    ...partContext,
    bodiesSeen,
    planetsSeen: (jdTT, sun, observer) => bodies.planetsSeen(jdTT, sun, observer),
    loadPlanets: () => bodies.loadPlanets(),
    deltaTUncertainty: (jdUT) => deltaT.uncertaintySeconds(jdUT),
    namedPlace,
    moonReady: () => moonEphemeris !== null,
    togglePanels,
    marks: (state) => records.marks(state),
  });
  // The impacts' paths through time (#304): the craters and today's coasts, loaded when opened,
  // from what the layers already loaded where they have.
  const impactPathsSheet = createImpactPathsSheet(
    (craters) => {
      store.set((state) => ({ ...state, craters }));
    },
    (cratersIn) => {
      store.set((state) => ({ ...state, cratersIn }));
    },
    async () => {
      const [loaded, periods] = await Promise.all([
        impacts ?? impactsLoading ?? loadImpacts(`${base}data/impacts.json`, fetchJson),
        namedPeriods?.data ??
          namedPeriodsLoading ??
          loadNamedPeriods(`${base}data/periods.json`, fetchJson),
      ]);
      return { impacts: loaded, coasts: countryRings(periods) };
    },
    (ma, where) => {
      store.set((state) => ({ ...state, craters: null }));
      partContext.goToDeepTime(ma, 'impacts', where);
    },
    whySheet.mark('impacts', 'Impact craters'),
  );
  // "Why here?": while on, a tap on the globe says what each layer has there.
  let askingHere = false;
  const sourcesList = element('ul', { class: 'why-list', 'data-testid': 'sources-list' });
  const layersPanel = createLayersPanel(
    (layer, on) => {
      store.set((state) => ({ ...state, layers: withLayer(state.layers, layer, on) }));
    },
    (borders) => {
      store.set((state) => ({ ...state, borders }));
    },
    (span, ma) => {
      if (ma === undefined || span === 'years') goToSpan(span);
      else if (store.get().ma === null) enterDeepTime(ma, span);
      else {
        setScale(span);
        store.set((state) => ({ ...state, ma: roundMa(ma) }));
      }
    },
    (layer, label) => whySheet.mark(() => layerWhy(layer, store.get().borders), label),
  );
  const markerCard = createMarkerCard();
  // How far out the view is, and that zooming out reaches the planets: from whichever body is
  // in focus, in the years (deep time leaves the Sun, Moon and planets out).
  const zoomRail = createZoomRail({
    onZoom(distance) {
      globe.zoomTo(distance);
    },
    onWhyHere() {
      askingHere = !askingHere;
      store.set((state) => ({
        ...state,
        why: askingHere ? 'here' : state.why === 'here' ? null : state.why,
      }));
    },
    onOrbits() {
      store.set((state) => ({
        ...state,
        layers: withLayer(state.layers, 'orbits', !state.layers.has('orbits')),
      }));
    },
    onSpacecraft() {
      store.set((state) => ({
        ...state,
        layers: withLayer(state.layers, 'spacecraft', !state.layers.has('spacecraft')),
      }));
    },
    onAsteroids() {
      store.set((state) => ({
        ...state,
        layers: withLayer(state.layers, 'asteroids', !state.layers.has('asteroids')),
      }));
    },
    onEarth() {
      store.set((state) => ({ ...state, focus: 'earth', view: 'free' }));
    },
  });
  const waysLegend = createWaysLegend(whySheet.mark('ways', 'Ways of life'));
  // The eclipse picked before entering deep time, picked again on leaving it.
  let selectionBeforeDeep: ViewState['selection'] = null;
  function leaveDeepTime(): void {
    stopPlay();
    const selection = selectionBeforeDeep;
    selectionBeforeDeep = null;
    store.set((state) => {
      // Within the Holocene's years, the same moment, now as a year; else the year left.
      // (If deep time is still where it was entered, the very date left comes back.)
      const { ma } = state;
      const time =
        ma !== null && ma <= HOLOCENE_MA && ma !== roundMa(maOfYear(state.time.date.year))
          ? moveToYear(state.time, astronomicalYear(yearOfMa(ma)))
          : state.time;
      // Layers stay on: one set for all of time, each drawing on its own spans.
      return { ...state, ma: null, time, selection: state.selection ?? selection };
    });
  }
  /** Go to a span, keeping the moment: the years are the Holocene's, the rest deep time. */
  /**
   * Picking a span is a fresh start: deep time's spans open at their oldest moment, ready to
   * play forward; the years come back to the date left. (A link with ma= opens where it points.)
   */
  function goToSpan(span: Span): void {
    const { ma } = store.get();
    if (span === 'years') {
      if (ma !== null) leaveDeepTime();
    } else if (ma === null) {
      enterDeepTime(spanOf(span), span);
    } else {
      stopPlay();
      sync.step();
      store.set((state) => ({ ...state, deepScale: span, ma: roundMa(spanOf(span)) }));
    }
  }
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
  function setScale(deepScale: DeepScale): void {
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
  }
  const deepBar = createDeepTimeBar(
    {
      why(id, label) {
        return whySheet.mark(id, label);
      },
      explain(id) {
        store.set((state) => ({ ...state, why: id }));
      },
      onMa(ma, jump) {
        stopPlay();
        if (jump) sync.step();
        store.set((state) => ({ ...state, ma: roundMa(ma) }));
      },
      onPlay(play) {
        if (play) startPlay();
        else stopPlay();
      },
      onSpeed(maPerSecond) {
        deepSpeeds = { ...deepSpeeds, [store.get().deepScale]: maPerSecond };
        showDeepTime(store.get());
      },
      onPlates(on) {
        store.set((state) => ({ ...state, layers: withLayer(state.layers, 'plates', on) }));
      },
      onAir(on) {
        store.set((state) => ({ ...state, layers: withLayer(state.layers, 'air', on) }));
      },
      onCo2Archive() {
        loadArchive();
      },
      onImpactsMode(mode) {
        impactsMode = mode;
        showDeepTime(store.get());
      },
      onImpacts(on) {
        store.set((state) => ({ ...state, layers: withLayer(state.layers, 'impacts', on) }));
      },
      onLayer(layer, on) {
        store.set((state) => ({ ...state, layers: withLayer(state.layers, layer, on) }));
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
      onTemperatureModel(temperatureModel) {
        store.set((state) => ({ ...state, temperatureModel }));
      },
      onTemperatureShow(temperatureShow) {
        store.set((state) => ({ ...state, temperatureShow }));
      },
      onSketch(choice) {
        store.set((state) => ({ ...state, ...choice }));
      },
      onTemperature(on) {
        store.set((state) => ({ ...state, layers: withLayer(state.layers, 'temperature', on) }));
      },
    },
    // The features' chips (#380), where the fossils' chip stood.
    FEATURES.flatMap((feature) =>
      feature.deepChip === undefined ? [] : [{ layer: feature.id, ...feature.deepChip }],
    ),
  );
  const globeContainer = element('div', { class: 'globe', 'data-testid': 'globe' });
  // The globe draws at once and takes its maps as they arrive; nothing below waits on them.
  // It sizes itself once its container is on the page.
  const globe = createGlobe(globeContainer, {
    camera: store.get().camera,
    textureUrl: `${base}textures/earth-blue-marble-2048.jpg`,
    moonTextureUrl: `${base}textures/moon-lroc-1k.jpg`,
    focus: store.get().focus,
  });
  // A tablet's records checked against the sky, and looked at from Babylon (#447).
  const records = mountRecords({
    ...partContext,
    moon: () => moonEphemeris,
    loadPlanets: () => bodies.loadPlanets(),
    deltaTSeconds: (jd) => deltaT.seconds(jd),
    setSkyMarks: (marks) => {
      sky.setMarks(marks);
    },
  });
  // The Sun, the Moon, the planets and their moons up close (#449).
  const bodies = mountBodies({
    ...partContext,
    globe,
    zoomRail,
    moon: () => moonEphemeris,
    refresh: () => {
      showTime(store.get());
    },
  });
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
  // The panels hide for a clear view, by this button or a tap on empty space; it brings them back.
  const fullView = element(
    'button',
    { type: 'button', class: 'full-view', 'aria-label': 'Hide the panels for a full view' },
    uiIcon('fullView', 16),
    element('span', { class: 'icon-label' }, 'Full view'),
  );
  fullView.addEventListener('click', togglePanels);
  // The site's texts as passages, asked for once, by search or by what is written about here.
  const passages = cachedPassages(`${base}data/passages.json`, (url) => fetch(url));
  // The site's texts, searched by their words; a passage opens the view of its place (#392).
  const searchPanel = createSearchPanel(
    () => passages().then(indexPassages),
    // Search by meaning (#393), asked for only once the reader turns it on.
    () => loadMeaningSearch(base, passages),
    (anchor) => {
      openAnchor(anchor);
    },
  );
  // What is written about where the reader looks, at the moment shown (#391).
  const hereList = element('ul', { class: 'here-list', 'data-testid': 'here-list' });
  const hereText = element(
    'details',
    { class: 'here-text' },
    element('summary', {}, 'About here'),
    hereList,
  );
  let herePassages: readonly Passage[] | null = null;
  hereText.addEventListener('toggle', () => {
    if (!hereText.open || herePassages !== null) return;
    hereList.replaceChildren(element('li', { class: 'here-empty' }, 'Loading…'));
    passages().then(
      (loaded) => {
        herePassages = loaded;
        showHere(store.get());
      },
      () => {
        hereList.replaceChildren(
          element('li', { class: 'here-empty' }, 'Could not load the texts.'),
        );
      },
    );
  });
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
  const card = createEclipseCard(whySheet.mark('eclipses', 'Eclipse'));
  // The Holocene track: the years played by, from as far back as ΔT reaches to the present.
  let historySpeed: YearSpeed = 50;
  let historyPlaying = false;
  let historyFrame = 0;
  let historyTick = 0;
  let historyHead = yearPlayhead();
  // What the track last said of the states (nothing until they change), and what was drawn
  // then, to tell what changed.
  let statesSaid = '';
  let statesBefore: {
    readonly source: BorderSource;
    readonly year: number;
    readonly places: readonly NamedPoint[];
  } | null = null;
  // How far back time reaches, one choice for all of it: going deeper is zooming out, to the
  // same moment.
  const historySpan = createSpanSwitch((span) => {
    goToSpan(span);
  });
  // The Holocene's ages under its slider; a tap goes to an age's start.
  const historyBands = createPeriodBands(
    (ma) => {
      stopHistory();
      setYear(Math.max(historyFirst(), yearOfMa(ma)));
    },
    // In the years, a moment is its year (the ends without the CE everyone assumes); the
    // round marks are every other millennium.
    {
      words: (ma) => formatYear(astronomicalYear(yearOfMa(ma))),
      short: (ma) => formatYear(astronomicalYear(yearOfMa(ma))).replace(/ CE$/, ''),
      marks: yearTicks,
    },
  );
  // Carbon-14 in the air under the years' slider (#270), its curves loaded once the layer is on.
  const datingCard = createDatingCard();
  // Where cosmic rays make carbon-14 (#269): a glow over the globe, for the field and Sun picked
  // in its card.
  const carbonMadeCard = createCarbonMadeCard(
    () => {
      showCarbonMade(store.get());
      showEmpires(store.get());
    },
    (made, fromSun) => {
      watchShower(made.field.dipole, fromSun);
    },
  );
  // The stage the shower plays on: its caption, its steps, and controls; the panels step aside.
  const showerStage = createShowerStage((command) => {
    globe.controlShower(command);
    if (command === 'stop') {
      showerStage.close();
      closeStory3d();
    }
  });

  // The story's chapters in 3D (#317), over the globe: the Sun's in one scene, the air's in
  // another, the plant's in a third, each loaded the first time one of its steps shows, one at a time; a scene's WebGL
  // context is let go when the story leaves it or closes. Should one fail to load, the stage
  // draws the steps flat, as before.
  const SCENE_OF: Readonly<Record<ShowerStep, 'sun' | 'air' | 'leaf'>> = {
    fusion: 'sun',
    escape: 'sun',
    journey: 'sun',
    rays: 'air',
    shower: 'air',
    capture: 'air',
    dioxide: 'leaf',
    fall: 'leaf',
    plant: 'leaf',
  };
  const STEPS_IN_3D: ReadonlySet<ShowerStep> = new Set(Object.keys(SCENE_OF) as ShowerStep[]);
  const storyContainer = element('div', {
    class: 'story-3d',
    'data-testid': 'story-3d',
    hidden: '',
  });
  type Story3d =
    | { readonly kind: 'sun'; readonly scene: SunCore }
    | { readonly kind: 'air'; readonly scene: AirShower }
    | { readonly kind: 'leaf'; readonly scene: LeafScene };
  let story3d: Story3d | null = null;
  let story3dLoading: 'sun' | 'air' | 'leaf' | null = null;
  let story3dFailed = false;
  /** The step the 3D scene last showed, to start a chapter afresh on coming to it. */
  let story3dStep: ShowerStep | null = null;
  let story3dLatest: {
    readonly state: ShowerState;
    readonly reduced: boolean;
    readonly caption: string;
  } | null = null;
  /** The shower the scenes draw: where, under what field, over land or sea, from the Sun. */
  let story3dShower: {
    readonly place: GeoPoint;
    readonly dipole: number;
    readonly water: boolean;
    readonly fromSun: boolean;
  } | null = null;
  showerStage.setDrawnIn3d(STEPS_IN_3D);

  /** Load a scene's code and make it, if the story still wants it once it has loaded. */
  function loadStory3d(kind: 'sun' | 'air' | 'leaf'): void {
    story3dLoading = kind;
    const earthTextureUrl = `${base}textures/earth-blue-marble-2048.jpg`;
    const wanted = (): boolean =>
      story3dLoading === kind &&
      showerStage.isOpen &&
      story3dLatest !== null &&
      SCENE_OF[story3dLatest.state.step] === kind;
    const made: Promise<Story3d | null> =
      kind === 'sun'
        ? import('./story/sunCore').then(({ createSunCore }) =>
            wanted() ? { kind, scene: createSunCore(storyContainer, { earthTextureUrl }) } : null,
          )
        : kind === 'air'
          ? import('./story/airShower').then(({ createAirShower }) => {
              if (!wanted()) return null;
              if (story3dShower === null) throw new Error('no shower to draw yet');
              const { place, dipole, water } = story3dShower;
              return {
                kind,
                scene: createAirShower(storyContainer, { earthTextureUrl, place, dipole, water }),
              };
            })
          : import('./story/leafScene').then(({ createLeafScene }) => {
              if (!wanted()) return null;
              if (story3dShower === null) throw new Error('no shower to draw yet');
              const { water, fromSun } = story3dShower;
              return { kind, scene: createLeafScene(storyContainer, { water, fromSun }) };
            });
    made
      .then((scene) => {
        if (story3dLoading === kind) story3dLoading = null;
        story3d = scene ?? story3d;
        if (story3dLatest !== null) {
          const latest = story3dLatest;
          showStory3d(latest.state, latest.reduced, latest.caption);
        }
      })
      .catch((error: unknown) => {
        story3dLoading = null;
        story3dFailed = true;
        storyContainer.hidden = true;
        showerStage.setDrawnIn3d(new Set());
        if (story3dLatest !== null) showerStage.render(story3dLatest.state, story3dLatest.caption);
        notify(`Could not draw the story in 3D, so it is drawn flat: ${errorMessage(error)}`);
      });
  }

  function showStory3d(state: ShowerState, reduced: boolean, caption: string): void {
    story3dLatest = { state, reduced, caption };
    const before = story3dStep;
    story3dStep = state.step;
    const kind = SCENE_OF[state.step];
    if (story3dFailed) {
      storyContainer.hidden = true;
      story3d?.scene.setPlaying(false);
      return;
    }
    storyContainer.hidden = false;
    if (story3d?.kind !== kind) {
      // The other scene, if one is up, gives way; this one starts afresh once it has loaded.
      story3d?.scene.dispose();
      story3d = null;
      story3dStep = null;
      if (story3dLoading !== kind) loadStory3d(kind);
      return;
    }
    if (before !== state.step) {
      const { step } = state;
      if (story3d.kind === 'sun') {
        story3d.scene.setChapter(step === 'escape' || step === 'journey' ? step : 'fusion');
      } else if (story3d.kind === 'air') {
        story3d.scene.setChapter(step === 'shower' || step === 'capture' ? step : 'rays');
      } else {
        story3d.scene.setChapter(step === 'fall' || step === 'plant' ? step : 'dioxide');
      }
      if (reduced) story3d.scene.settle();
      else story3d.scene.restart();
    }
    if (!reduced) story3d.scene.setPlaying(state.playing);
  }

  function closeStory3d(): void {
    story3d?.scene.dispose();
    story3d = null;
    story3dLoading = null;
    story3dStep = null;
    story3dLatest = null;
    storyContainer.hidden = true;
  }

  // Today's land and sea, to say whether the carbon lands on land or water; asked for once.
  let elevations: Promise<ElevationGrid | null> | null = null;
  function landAndSea(): Promise<ElevationGrid | null> {
    elevations ??= loadShelf(`${base}data/shelf/index.json`, fetchJson)
      .then((index) => loadElevationGrid(`${base}data/shelf/${index.file}`, index))
      .catch((error: unknown) => {
        elevations = null;
        notify(`Could not load today's coasts: ${errorMessage(error)}`);
        return null;
      });
    return elevations;
  }

  /**
   * Play a cosmic-ray shower over the meridian in view: seen from the side as the rays come in,
   * then close up as one bursts, under the field picked. It ends on a plant where it lands on
   * land, and on algae where it lands on water.
   */
  function watchShower(dipole: number, fromSun: boolean): void {
    const story = fromSun ? SUN_STORY : SHOWER_STORY;
    /** Turn to a body: the Sun for its steps, Earth for the shower's. */
    const focusOn = (body: 'sun' | 'earth'): void => {
      if (store.get().focus !== body)
        store.set((state) => ({ ...state, focus: body, view: 'free' }));
    };
    focusOn('earth');
    layersPanel.dialog.close();
    // Over the place picked, if it is far enough from the equator for rays to get through
    // today; else at 60° along the meridian in view.
    const picked = store.get().location;
    const place =
      picked !== null && Math.abs(picked.latitude) >= 35
        ? { latitude: picked.latitude, longitude: picked.longitude }
        : { latitude: 60, longitude: store.get().camera.target.longitude };
    const { longitude } = place;
    /** Where the camera stands for each step, whichever way the reader came to it. */
    const frame = (step: ShowerStep): void => {
      if (step === 'fusion' || step === 'escape' || step === 'journey') {
        // The Sun, close up, while its part of the story is drawn on the stage.
        focusOn('sun');
        return;
      }
      focusOn('earth');
      if (step === 'rays') {
        // From the side, so the rays are seen coming in from space.
        globe.flyTo({ latitude: 20, longitude: longitude - 90 });
        globe.zoomTo(4.4);
      } else if (step === 'fall' || step === 'plant') {
        // A little toward the equator, to follow it falling to where it lands.
        globe.flyTo({ latitude: place.latitude - 1.5, longitude });
        globe.zoomTo(1.35);
      } else {
        // In close over the strike, for the shower and what it makes.
        globe.flyTo(place);
        globe.zoomTo(1.35);
      }
    };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    frame(fromSun ? 'fusion' : 'rays');
    showerStage.open(reduced, story);
    // Once the globe has turned to it, and today's coasts have said where it lands.
    const turned = new Promise((done) => window.setTimeout(done, 1000));
    void Promise.all([landAndSea(), turned]).then(([grid]) => {
      const water = grid !== null && !onLand(grid, landing(place));
      story3dShower = { place, dipole, water, fromSun };
      let framed: ShowerStep | null = null;
      globe.playShower({
        place,
        dipole,
        water,
        fromSun,
        onState(state) {
          if (state.step !== framed) {
            framed = state.step;
            frame(state.step);
          }
          const caption = captionOf(state.step, dipole, water, fromSun);
          showerStage.render(state, caption);
          showStory3d(state, reduced, caption);
        },
      });
      // Under reduced motion, each step waits for the reader, its picture complete.
      if (reduced) globe.controlShower('settle');
    });
  }
  let carbonMadeSaid: string | null = null;
  let carbonMadeAction: { readonly label: string; readonly run: () => void } | null = null;

  // The dipole's strength through the years radiocarbon reaches (GGF100k), loaded with the layer.
  let dipole: DipoleSeries | null = null;
  let dipoleAsked = false;

  /** The field at the moment shown, or null until it loads or beyond its reach. */
  function fieldThen(state: ViewState): ReturnType<typeof thenField> | null {
    if (dipole === null) {
      if (!dipoleAsked) {
        dipoleAsked = true;
        loadDipole(`${base}data/dipole.json`, fetchJson).then(
          (loaded) => {
            dipole = loaded;
            showCarbonMade(store.get());
            showEmpires(store.get());
          },
          (error: unknown) => {
            dipoleAsked = false;
            notify(`Could not load the field's strength: ${errorMessage(error)}`);
          },
        );
      }
      return null;
    }
    // Thousands of years before 1950, as the model counts.
    const ka = state.ma === null ? (1950 - state.time.date.year) / 1000 : state.ma * 1000;
    const strength = dipoleAt(dipole, ka);
    return strength === null ? null : thenField(strength);
  }

  /** The glow, on the spans and years radiocarbon reaches; what the layer says, and its card. */
  function showCarbonMade(state: ViewState): void {
    const layerOn = state.layers.has('carbonMade') && state.mode === 'globe';
    const span = state.ma === null ? 'years' : state.deepScale;
    const here = span === 'years' || span === 'ice';
    const reached = state.ma === null || state.ma * 1e6 <= DATABLE_YEARS;
    carbonMadeAction =
      layerOn && here
        ? {
            label: 'How is it made?',
            run: () => {
              carbonMadeCard.open();
            },
          }
        : null;
    if (!layerOn || !here || !reached) {
      carbonMadeSaid = layerOn && here ? CARBON_LIMIT : null;
      globe.setC14Glow(null);
      return;
    }
    carbonMadeCard.setThen(fieldThen(state));
    const made = carbonMadeCard.current();
    globe.setC14Glow(glowOf(made));
    const sun = made.sun.label.toLowerCase();
    if (made.field.id !== THEN_ID) {
      carbonMadeSaid =
        state.ma === null
          ? `${made.field.label} field, ${sun}: most is made over the poles.`
          : `Drawn for the field picked (${made.field.label.toLowerCase()}), not that of the moment shown.`;
      return;
    }
    const strength = made.field.dipole.toFixed(1);
    carbonMadeSaid =
      made.field !== THEN_UNKNOWN
        ? made.field.dipole < 4
          ? `The field at the moment shown is weak, ${strength} × 10²² A m² (GGF100k; today’s is 7.8): more is made, and nearer the equator. Other models put this low far lower (Korte et al. 2019).`
          : `The field at the moment shown, ${strength} × 10²² A m² (GGF100k), ${sun}: most is made over the poles.`
        : `The field at the moment shown is not known yet; today’s is drawn, ${sun}.`;
  }
  const radiocarbonStrip = createRadiocarbonStrip(
    whySheet.mark('radiocarbon', 'Carbon-14 in the air'),
    (curve, name) => {
      datingCard.open(curve, name);
    },
  );
  const historyTrack = createHistoryTrack(
    {
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
      onEndTravel() {
        stopHistory();
        setTravel(false);
      },
    },
    historyBands.root,
    radiocarbonStrip.root,
  );
  // Away from Earth and the Moon, the bar's time is the body's own cycle as Earth sees it: a
  // planet's from conjunction to conjunction, the Sun's Earth's year (#329).
  const cycleTrack = createCycleTrack({
    onDay(jd) {
      stopCycle();
      setMoment(jd);
    },
    onPlay(play) {
      if (play) startCycle();
      else stopCycle();
    },
    onSpeed(speed) {
      cycleSpeed = speed;
      showCycle(store.get());
    },
  });
  let cycle: {
    readonly body: PlanetName | 'sun';
    readonly at: BodyCycle;
    readonly moments: readonly CycleMoment[];
  } | null = null;
  let cyclePlaying = false;
  let cycleSpeed: CycleSpeed = 240;
  let cycleFrame = 0;
  let cycleTick = 0;
  // Where play has got to, UT, unrounded; shown a whole day at a time, so the time of day (and
  // so how the bodies are turned) holds still as the days go by.
  let cycleHead = 0;
  let cycleShown: ViewState['time'] | null = null;
  /** The body whose cycle the bar shows: a planet or the Sun, in the years, no eclipse open. */
  function cycleBody(state: ViewState): PlanetName | 'sun' | null {
    const { focus } = state;
    if (!awayFromEarth(state) || state.selection !== null) return null;
    // A planet's moon goes by its planet's cycle.
    if (isMoonBody(focus)) return moonPlanet(focus);
    return focus === 'earth' || focus === 'moon' ? null : focus;
  }
  /** A moment of the cycle as written: "16 Jan 2025". */
  function cycleDate(jd: JulianDay): string {
    const { year } = calendarDate(jd, historicalCalendar(jd));
    return `${shortDate('western', jd)} ${formatYear(astronomicalYear(year))}`;
  }
  function showCycle(state: ViewState): void {
    const body = cycleBody(state);
    // With an eclipse open its own player runs the time; on a planet or the Sun, the cycle.
    historyTrack.root.hidden = state.selection !== null || body !== null;
    historyTrack.extras.hidden = historyTrack.root.hidden;
    const theory = bodies.planets();
    if (body === null || theory === null || bodiesAt === null) {
      if (body === null) stopCycle();
      else if (theory === null) void bodies.loadPlanets();
      cycleTrack.render(null);
      return;
    }
    stopHistory();
    const jdTT = bodiesAt;
    if (cycle?.body !== body || jdTT < cycle.at.start || jdTT >= cycle.at.end) {
      const at = body === 'sun' ? sunCycle(theory, jdTT) : planetCycle(theory, body, jdTT);
      cycle = {
        body,
        at,
        moments: at.events.map(({ mark, jdTT: when }) => {
          const jd = deltaT.universalTime(julianDayNumber(when));
          return { mark, jd, date: cycleDate(jd) };
        }),
      };
    }
    cycleTrack.render({
      title:
        body === 'sun'
          ? 'Earth’s year around the Sun'
          : `${PLANET_NAMES[body]}’s cycle, as seen from Earth`,
      slider: body === 'sun' ? 'Day in Earth’s year' : `Day in ${PLANET_NAMES[body]}’s cycle`,
      jd: momentJulianDay(state.time),
      moments: cycle.moments,
      playing: cyclePlaying,
      speed: cycleSpeed,
    });
  }
  function setMoment(jd: number): void {
    const time = momentAt(julianDayNumber(jd));
    cycleShown = time;
    store.set((state) => ({ ...state, time, selection: null }));
  }
  function startCycle(): void {
    cyclePlaying = true;
    cycleHead = momentJulianDay(store.get().time);
    cycleTick = performance.now();
    cycleFrame = requestAnimationFrame(tickCycle);
    showCycle(store.get());
  }
  function tickCycle(now: number): void {
    if (!cyclePlaying) return;
    // A frame after a stall (a hidden tab) counts as a quarter of a second at most.
    const seconds = Math.min(Math.max(now - cycleTick, 0) / 1000, 0.25);
    cycleTick = now;
    const shown = momentJulianDay(store.get().time);
    cycleHead += (cycleSpeed / 24) * seconds;
    // A day or more a second steps whole days, so each planet's turning holds still; slower
    // steps whole minutes, the finest time kept, so moons glide round (#335).
    const step = cycleSpeed >= 24 ? 1 : 1 / 1440;
    const steps = Math.floor((cycleHead - shown) / step + 1e-9);
    if (steps >= 1) setMoment(shown + steps * step);
    cycleFrame = requestAnimationFrame(tickCycle);
  }
  function stopCycle(): void {
    if (!cyclePlaying) return;
    cyclePlaying = false;
    cancelAnimationFrame(cycleFrame);
    showCycle(store.get());
  }

  let radiocarbon: Radiocarbon | null = null;
  let radiocarbonAsked = false;
  // The eruptions the ice cores record (HolVol), under the curve; loaded with it.
  let eruptions: Eruptions | null = null;
  let eruptionsAsked = false;
  /** The strip, for the years shown, from the curve of the hemisphere one stands in. */
  function showRadiocarbon(state: ViewState): void {
    const on = state.layers.has('radiocarbon') && state.mode === 'globe' && state.ma === null;
    if (!on) {
      radiocarbonStrip.render(null);
      return;
    }
    if (radiocarbon === null) {
      radiocarbonStrip.render(null);
      if (radiocarbonAsked) return;
      radiocarbonAsked = true;
      loadRadiocarbon(`${base}data/radiocarbon.json`, fetchJson).then(
        (loaded) => {
          radiocarbon = loaded;
          showRadiocarbon(store.get());
        },
        (error: unknown) => {
          radiocarbonAsked = false;
          notify(`Could not load the radiocarbon curves: ${errorMessage(error)}`);
        },
      );
      return;
    }
    if (eruptions === null && !eruptionsAsked) {
      eruptionsAsked = true;
      loadEruptions(`${base}data/eruptions.json`, fetchJson).then(
        (loaded) => {
          eruptions = loaded;
          showRadiocarbon(store.get());
        },
        (error: unknown) => {
          eruptionsAsked = false;
          notify(`Could not load the eruptions: ${errorMessage(error)}`);
        },
      );
    }
    const south = (state.location?.latitude ?? 1) < 0;
    const first = historyFirst();
    radiocarbonStrip.render({
      curve: south ? radiocarbon.curves.shcal20 : radiocarbon.curves.intcal20,
      name: south ? 'SHCal20' : 'IntCal20',
      first,
      last: PRESENT_YEAR,
      events: RADIOCARBON_EVENTS,
      eruptions: eruptions === null ? null : eruptionsBetween(eruptions, first, PRESENT_YEAR),
    });
  }
  /**
   * The travel view, on as the years play and until the reader leaves it: even light, states
   * and ways of life, the year's ice and sea; markers of single finds and events resting.
   */
  function setTravel(open: boolean): void {
    if (open === travelling) return;
    travelling = open;
    globe.setEvenLight(open);
    // The trip is about peoples and states: their borders, and how people lived where no
    // state is drawn, come on with it, and go with it if it brought them.
    const { layers } = store.get();
    if (open) {
      travelBrought = TRAVEL_LAYERS.filter((layer) => !layers.has(layer));
      if (travelBrought.length > 0) {
        store.set((state) => ({
          ...state,
          layers: new Set([...state.layers, ...travelBrought]),
        }));
      }
    } else if (travelBrought.length > 0) {
      const brought = new Set<Layer>(travelBrought);
      travelBrought = [];
      store.set((state) => ({
        ...state,
        layers: new Set([...state.layers].filter((layer) => !brought.has(layer))),
      }));
    }
    const now = store.get();
    showDates(now);
    showImpacts(now);
    if (lastTerrestrial !== null) showFeatures(now, lastTerrestrial);
    showRocks(now);
    showEmpires(now);
    showHoloceneEarth(now);
    showHistory(now);
  }
  // While the track is open, the globe is lit evenly and the markers of single finds and
  // events rest: at years a second they flicker past without meaning.
  let travelling = false;
  const TRAVEL_LAYERS: readonly Layer[] = ['empires', 'ways'];
  let travelBrought: readonly Layer[] = [];

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
    setTravel(true);
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
    showRadiocarbon(state);
    // Unclamped: the years run past 1950, where deep time's present stops.
    const maOf = (year: number): number => (1950 - year) / 1e6;
    historyBands.render({
      oldest: maOf(historyFirst()),
      ma: maOf(state.time.date.year),
      youngest: maOf(PRESENT_YEAR),
      playing: historyPlaying,
    });
    historyTrack.render({
      year: state.time.date.year,
      first: historyFirst(),
      last: PRESENT_YEAR,
      playing: historyPlaying,
      travelling,
      speed: historySpeed,
      // What changed whenever states are on; while travelling, what to expect until then.
      changes: state.layers.has('empires')
        ? statesSaid === '' && travelling
          ? STATES_WAIT
          : statesSaid
        : travelling
          ? STATES_HINT
          : '',
      blank: state.layers.has('empires') ? blankText(state.layers.has('ways')) : null,
      earth: holoceneSea === null ? null : earthText(holoceneSea),
    });
  }

  /**
   * Note which states appeared or went since the year drawn before, if it was near; and give
   * those to name on the map, if it was nearer still.
   */
  function noteStates(
    source: BorderSource,
    year: number,
    places: readonly NamedPoint[],
  ): readonly StateChange[] {
    const before = statesBefore;
    statesBefore = { source, year, places };
    // Far apart, or by another source, a list of what differs says little about what happened.
    if (before?.source !== source || Math.abs(year - before.year) > 500) {
      return [];
    }
    const { appeared, gone } = stateChanges(
      before.places.map(({ name }) => name),
      places.map(({ name }) => name),
    );
    const said = changesText(year, appeared, gone);
    if (said !== null) statesSaid = said;
    showHistory(store.get());
    // On the map, only a step's worth (a year, or up to the fastest trip's 80): after a jump
    // of centuries every name would light up.
    const step = Math.abs(year - before.year);
    return step === 0 || step > 100 ? [] : stateChangesOnMap(before.places, places);
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
    [famousPanel.button, records.button],
    [historyTrack.extras, cycleTrack.extras],
  );
  const scrubber = createScrubber((offsetMinutes) => {
    const selected = selectedEclipse(store.get());
    if (selected === undefined) return;
    const jd = greatestEclipseUT(selected) + offsetMinutes / MINUTES_PER_DAY;
    store.set((state) => ({ ...state, time: momentAt(julianDayNumber(jd)) }));
  });

  const hudTools = [boundariesSheet.button, searchPanel.button, fullView];
  // Earth's spans and its map's layers; away from Earth they rest (#329).
  const hudActions = element('div', { class: 'hud-actions' }, historySpan.root, layersPanel.button);
  const bottom = element(
    'div',
    { class: 'bottom', 'data-deep': 'off' },
    card.root,
    scrubber.root,
    element(
      'div',
      { class: 'holocene-bar' },
      bodies.bar,
      waysLegend.root,
      historyTrack.root,
      cycleTrack.root,
      timeline.root,
    ),
    deepBar.root,
  );
  root.replaceChildren(
    globeContainer,
    sky.container,
    zoomRail.root,
    ...treeOfLife.elements,
    impactPathsSheet.dialog,
    boundariesSheet.dialog,
    whySheet.dialog,
    element(
      'header',
      { class: 'hud' },
      // The name leads home: today on the globe, as a first visit opens (welcome too, until the
      // visitor has dismissed it).
      element(
        'h1',
        {},
        element('a', { class: 'home', href: base, title: 'Back to the start' }, 'histeclipse'),
      ),
      element('div', { class: 'hud-tools' }, ...hudTools),
      element('p', { class: 'hud-when' }, dateText, ' ', timeText),
      detailText,
      termNote,
      welcome.root,
      hudActions,
      viewSwitch.root,
      ...sky.controls,
      ...bodies.switches,
      ...sky.captions,
      records.banner,
      // Sources and what is written about here share a line, each a full row once open.
      element(
        'div',
        { class: 'hud-more' },
        element(
          'details',
          { class: 'credits' },
          element('summary', {}, 'Sources'),
          // What is on screen now, each with the book that says why, and its sources' links.
          sourcesList,
        ),
        hereText,
      ),
    ),
    notices,
    glance.root,
    showControls,
    bottom,
    famousPanel.dialog,
    searchPanel.dialog,
    records.dialog,
    layersPanel.dialog,
    markerCard.dialog,
    datingCard.dialog,
    carbonMadeCard.dialog,
    storyContainer,
    showerStage.root,
  );

  // Full view hides the panels for a clear view; Show controls, Escape, or a tap on open sky or
  // empty space brings them back. A tap on open sky clears them too, as does one on the globe or
  // the space around it in deep time; in historical time a tap on the globe picks a place.
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
    // "/" opens search, unless it is being typed somewhere.
    const typing =
      event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
    if (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      searchPanel.open();
    }
  });
  /** Open a passage's anchor: its view laid over the reader's, as a step back can undo. */
  function openAnchor(anchor: Anchor): void {
    const next = parseViewState(anchorQuery(anchor, serializeViewState(store.get())), new Date());
    stopPlay();
    sync.step();
    store.set(() => next.state);
  }

  function notify(message: string): void {
    // A failure asked again (each time the view is drawn) says so once.
    if ([...notices.children].some((notice) => notice.textContent === message)) return;
    notices.append(element('li', {}, message));
  }
  parsed.warnings.forEach(notify);

  // Drawn on the globe as layers of their own (#379).
  const magneticNorthOnGlobe = globe.addLayer(magneticNorthLayer);
  const rocksOnGlobe = globe.addLayer(rocksLayer);
  const waysOnGlobe = globe.addLayer(waysLayer);
  const datesOnGlobe = globe.addLayer(dateCellsLayer);
  const iceOutlinesOnGlobe = globe.addLayer(iceOutlineLayer);
  const impactsOnGlobe = globe.addLayer(impactLayer);
  // The features on the contract (#380): mounted once, shown with each moment, picked by kind.
  const featureContext: FeatureContext = {
    base,
    fetchJson,
    globe,
    zoomRail,
    notify,
    showCard: (card) => {
      markerCard.show(card);
    },
    cardOpen: () => markerCard.dialog.open,
    planets: () => bodies.planets(),
    moon: () => moonEphemeris,
    loadPlanets: () => {
      void bodies.loadPlanets();
    },
    openLineages: treeOfLife.openLineagesAt,
    openTree: treeOfLife.openTreeAt,
    change: (update) => {
      store.set(update);
    },
    travelling: () => travelling,
    refresh: () => {
      const now = store.get();
      showTime(now);
      if (now.ma !== null) showDeepTime(now);
      showEmpires(now);
    },
  };
  const mounted = FEATURES.map((feature) => ({ feature, shown: feature.mount(featureContext) }));
  function showFeatures(state: ViewState, jdTT: number): void {
    for (const { shown } of mounted) shown.show?.(state, jdTT);
  }
  /** Deep time's chips, from the features that have one (#380). */
  function deepChips(state: ViewState, moment: DeepMoment): Map<Layer, DeepChipView> {
    const chips = new Map<Layer, DeepChipView>();
    for (const { feature, shown } of mounted) {
      const chip = shown.deep?.(state, moment) ?? null;
      if (chip !== null) chips.set(feature.id, chip);
    }
    return chips;
  }
  const [deltaT, lunarCatalog, solarCatalog] = await Promise.all([
    DeltaT.load(`${base}data/delta-t.json`, (url) => fetch(url)),
    LunarCatalog.load(`${base}data/lunar/`, (url) => fetch(url)),
    SolarCatalog.load(`${base}data/solar/`, (url) => fetch(url)),
  ]);
  const sync = createUrlSync(browserUrlWriter(window.location, window.history));

  // The Moon's theory is a separate chunk; until it arrives the space view shows only the Sun.
  let moonEphemeris: MoonEphemeris | null = null;
  loadMoonEphemeris().then(
    (ephemeris) => {
      moonEphemeris = ephemeris;
      showTime(store.get());
      viewSwitch.render(store.get().mode, store.get().view, true, store.get().focus);
      sky.render(store.get());
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
      planetsKm: bodies.planetPositions(terrestrial),
      jdTT: terrestrial,
    });
    lastTerrestrial = terrestrial;
    bodiesAt = terrestrial;
    bodies.setMoment(terrestrial);
    showBody(state);
    bodies.showOrbits(state, terrestrial);
    showFeatures(state, terrestrial);
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
      ' ',
      deltaTWhy,
    );
  }

  // ΔT's book, made once: the date line is written again as time moves.
  const deltaTWhy = whySheet.mark('delta-t', 'ΔT');
  const DELTA_T_MEANING =
    'ΔT: how far Earth’s slowing spin has put clock time behind a perfectly even time. It decides where on Earth an ancient eclipse fell; the ± is how uncertain it is.';

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

  const temperatureLayer = createTemperatureLayer({
    dataUrl: (path) => `${base}data/${path}`,
    fetchJson,
    globe,
    notify,
    arrived: () => {
      showDeepTime(store.get());
    },
  });

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

  // Every reversal of the last 83 Ma: small, loaded the first time deep time shows.
  let polarity: PolarityScale | null = null;
  let polarityAsked = false;
  function wantPolarity(): void {
    if (polarityAsked) return;
    polarityAsked = true;
    loadPolarity(`${base}data/polarity.json`, fetchJson).then(
      (loaded) => {
        polarity = loaded;
        showDeepTime(store.get());
      },
      (error: unknown) => {
        polarityAsked = false;
        notify(`Could not load the magnetic reversals: ${errorMessage(error)}`);
      },
    );
  }

  function showDeepTime(state: ViewState): void {
    const { ma } = state;
    bottom.dataset['deep'] = ma === null ? 'off' : 'on';
    magneticNorthOnGlobe.update(ma === null ? null : magneticNorthAt(ma, polarity));
    if (ma !== null) wantPolarity();
    if (ma === null) {
      historySpan.render('years');
      stopPlay();
      deepBar.render(null);
      glance.render(null);
      globe.setUncharted(false);
      globe.setSketch(null);
      globe.setDeepTime(null);
      globe.setTemperature(null);
      showHoloceneEarth(state);
      iceOutlinesOnGlobe.update(null);
      for (const { shown } of mounted) shown.deep?.(state, null);
      globe.setPlates(null);
      return;
    }
    const period = periodAt(ma);
    showDeepTimeText(ma);
    // A link to before the elevation maps opens on the scale that reaches it.
    const scale = state.deepScale === 'all' && ma > oldest ? 'eons' : state.deepScale;
    historySpan.render(scale);
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
      polarity,
      playing,
      speed: deepSpeedFor(state.deepScale, deepSpeeds[state.deepScale]),
      scale,
      coastline: showCoastline(ma, state),
      ice: showIce(state, ma),
      iceOutlines: showIceOutlines(state, ma),
      plateMotion: plateMotionText(state, ma),
      chips: deepChips(state, { ma, scale }),
      impacts: showImpacts(state),
      air: showAir(state),
      seaIce: showSeaIce(state, ma),
      temperature: temperatureLayer.view(state, { ma, ice, uncharted }),
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
      temperature: temperatureLayer.drawn(state, { ma, ice, uncharted }),
    });
    temperatureLayer.show(state, { ma, ice, uncharted }, playing ? playSpeed() : null);
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
        // Playing, the next maps load ahead, so the globe keeps up with the years.
        if (playing && !ice) {
          globe.prefetch(
            framesAhead(index.frames, ma, prefetchFrames(playSpeed())).map(
              (frame) => `${base}data/paleodem/${frame.file}`,
            ),
          );
        }
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

  // The gases of the last 540 million years: loaded the first time Air is on at that scale.
  let deepAir: DeepAir | null = null;
  let deepAirLoading: Promise<DeepAir> | null = null;

  function showAir(state: ViewState): DeepTimeView['air'] {
    if (state.deepScale === 'eons' || !state.layers.has('air')) return { on: false };
    if (state.deepScale === 'all') {
      if (deepAir === null && deepAirLoading === null) {
        deepAirLoading = loadDeepAir(`${base}data/air-deep.json`, fetchJson);
        deepAirLoading.then(
          (loaded) => {
            deepAir = loaded;
            showDeepTime(store.get());
          },
          (error: unknown) => {
            deepAirLoading = null;
            notify(`Could not load the deep-time gases: ${errorMessage(error)}`);
          },
        );
      }
      return { on: true, atmosphere, deep: deepAir, archive: co2Archive };
    }
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
    return { on: true, atmosphere, deep: deepAir, archive: co2Archive };
  }

  // The Paleo-CO2 Data Archive: loaded the first time the reader picks its estimates.
  let co2Archive: Co2Archive | null = null;
  let co2ArchiveLoading: Promise<Co2Archive> | null = null;

  function loadArchive(): void {
    if (co2Archive !== null || co2ArchiveLoading !== null) return;
    co2ArchiveLoading = loadCo2Archive(`${base}data/air-co2-archive.json`, fetchJson);
    co2ArchiveLoading.then(
      (loaded) => {
        co2Archive = loaded;
        showDeepTime(store.get());
      },
      (error: unknown) => {
        co2ArchiveLoading = null;
        notify(`Could not load the Paleo-CO₂ Data Archive: ${errorMessage(error)}`);
      },
    );
  }

  // Impact craters and deposits: loaded the first time the layer is turned on, in either time.
  let impacts: Impacts | null = null;
  let impactsLoading: Promise<Impacts> | null = null;
  let impactsSaid: string | null = null;
  // In deep time: each impact around its time, or every one that had struck by then.
  let impactsMode: ImpactsMode = 'around';

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
    if (!on || (travelling && ma === null)) {
      impactsSaid = on ? RESTING : null;
      impactsOnGlobe.update(null);
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
      return { on: true, text: null, mode: impactsMode };
    }
    if (ma === null) {
      // In historical time, today's places; a crater younger than the year shown is not there.
      const since = Math.max(0, BP_ZERO_YEAR - state.time.date.year) / 1e6;
      const marks = impactsAt(impacts, since, true);
      impactsOnGlobe.update(marks);
      impactsSaid = impactsText(impacts, marks, null);
      return { on: true, text: impactsSaid, mode: impactsMode };
    }
    // On the ice-age scale the map is today's, so the craters are where they are today.
    const placeMa = scale === 'ice' ? 0 : ma;
    const marks = impactsAt(impacts, ma, false, placeMa, impactsMode);
    impactsOnGlobe.update(marks);
    strikeAsItPasses(state, impacts, ma, placeMa);
    impactsSaid = null;
    return { on: true, text: impactsText(impacts, marks, ma, impactsMode), mode: impactsMode };
  }

  // As deep time plays, each crater strikes when the time passes it (#242, #314): several at
  // once, only on the side of the globe in view, and never for a reader who asks for less motion.
  let strikeFrom: number | null = null;
  const lessMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function strikeAsItPasses(state: ViewState, data: Impacts, ma: number, placeMa: number): void {
    const from = strikeFrom;
    strikeFrom = playing ? ma : null;
    if (from === null || !playing || lessMotion.matches || state.focus !== 'earth') return;
    // Of those passed since the last frame, the greatest few that can be seen.
    const seen = strikesPassed(data, from, ma)
      .map((impact) => ({ impact, place: placeThen(data, impact, placeMa) }))
      .filter(
        (each): each is { impact: Impact; place: GeoPoint } =>
          each.place !== null && angularDistance(each.place, state.camera.target) < STRIKE_IN_VIEW,
      )
      .sort((a, b) => (b.impact.diameterKm ?? 0) - (a.impact.diameterKm ?? 0));
    for (const { impact, place } of seen.slice(0, STRIKES_AT_ONCE).reverse()) {
      const approach = approachOf(impact.name);
      // The latest few struck, for whoever needs to know one did: they follow fast as time runs.
      const struck = (globeContainer.dataset['strikes'] ?? '').split('|').filter(Boolean);
      globeContainer.dataset['strikes'] = [...struck, impact.name].slice(-12).join('|');
      globe.playImpact({
        place,
        craterKm: impact.diameterKm ?? 0,
        fromAzimuth: approach.fromAzimuth,
        angleDegrees: approach.angleDegrees,
      });
    }
  }

  globe.onMarkerPick((key) => {
    const [kind, id] = key.split(':');
    for (const { shown } of mounted) shown.unpick?.();
    const picked = mounted.find(({ feature }) => feature.picks === kind);
    if (picked !== undefined) {
      picked.shown.pick?.(key.slice(key.indexOf(':') + 1));
      return;
    }
    const impact = impacts?.impacts.find((each) => String(each.id) === id);
    if (kind !== 'impact' || impact === undefined) return;
    const details = impactDetails(impact);
    // Where it lies at the moment shown: today's place, or where the plates had it.
    const place = impacts === null ? null : placeThen(impacts, impact, store.get().ma ?? 0);
    const craterKm = impact.diameterKm;
    markerCard.show({
      title: details.title,
      facts:
        craterKm === null
          ? details.facts
          : [...details.facts, ['Impactor', impactorText(impact.name, craterKm)]],
      links: [details.link],
      ...(place === null || craterKm === null
        ? {}
        : {
            action: {
              label: 'Play the impact (an illustration)',
              run: () => {
                playImpact(impact.name, place, craterKm);
              },
            },
          }),
    });
  });

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
      iceOutlinesOnGlobe.update(null);
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
    iceOutlinesOnGlobe.update(outlines);
    return outlines;
  }

  /** The ice-sheet maps' index, asked for once; null until it arrives. */
  function iceSheets(): IceSheetIndex | null {
    if (iceIndex === null && iceLoading === null) {
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
    return iceIndex;
  }

  /**
   * While travelling through the Holocene: the ice sheets and the sea level of the year, over
   * today's Earth: the shelf the lower sea left bare, and the ice that still lay on the land.
   */
  function showHoloceneEarth(state: ViewState): void {
    if (!travelling || state.mode !== 'globe') {
      holoceneSea = null;
      showSeaIce(state, null);
      globe.setShelf(null);
      globe.setIce(null);
      return;
    }
    const ka = kaBeforePresent(state.time.date.year);
    const levels = seaLevels();
    const shelf = shelves();
    const coastline = levels === null ? null : coastlineAt(levels, state.coast, ka);
    holoceneSea = coastline;
    showSeaIce(state, null);
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
    const ice = iceSheets();
    if (ice === null) {
      globe.setIce(null);
      showHistory(state);
      return;
    }
    const { younger, older, mix } = framesAround(iceFramesInMa(ice), ka / 1000);
    globe.setIce({
      younger: `${base}data/icesheets/${younger.file}`,
      older: `${base}data/icesheets/${older.file}`,
      mix,
      columns: ice.columns,
      rows: ice.rows,
      metresPerStep: ice.metresPerStep,
    });
    showHistory(state);
  }
  let holoceneSea: Coastline | null = null;

  /** On the ice-age scale, the ice sheets of the moment, where the maps reach. */
  function showIce(state: ViewState, ma: number): DeepTimeView['ice'] {
    if (state.deepScale !== 'ice') {
      globe.setIce(null);
      return { drawn: false, oldestKa: null, standIn: null };
    }
    const index = iceSheets();
    if (index === null) return { drawn: false, oldestKa: null, standIn: null };
    const oldestKa = oldestIceKa(index);
    if (ma * 1000 > oldestKa) {
      const standIn = iceStandInFor(state, ma, index);
      globe.setIce(
        standIn === null
          ? null
          : {
              younger: `${base}data/icesheets/${standIn.file}`,
              older: `${base}data/icesheets/${standIn.file}`,
              mix: 0,
              columns: index.columns,
              rows: index.rows,
              metresPerStep: index.metresPerStep,
            },
      );
      return { drawn: standIn !== null, oldestKa, standIn };
    }
    const { younger, older, mix } = framesAround(iceFramesInMa(index), ma);
    globe.setIce({
      younger: `${base}data/icesheets/${younger.file}`,
      older: `${base}data/icesheets/${older.file}`,
      mix,
      columns: index.columns,
      rows: index.rows,
      metresPerStep: index.metresPerStep,
    });
    return { drawn: true, oldestKa, standIn: null };
  }

  // Sea ice: its index loads the first time a globe of Earth is shown.
  let seaIceIndex: SeaIceIndex | null = null;
  let seaIceLoading: Promise<SeaIceIndex> | null = null;

  /**
   * Sea ice blended from today's towards the chosen model's: on the ice-age scale, and in the
   * years (ma null) by the time of year, at the travelled year's sea level or else today's.
   */
  function showSeaIce(state: ViewState, ma: number | null): SeaIceView | null {
    if (ma !== null && state.deepScale !== 'ice') {
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
    const maps = seaIceMaps(seaIceIndex, state.seaIce, `${base}data/seaice/`);
    const levels = seaLevels();
    const ago = ma === null || levels === null ? null : coastlineAt(levels, state.coast, ma * 1000);
    const at = ma === null ? holoceneSea : ago;
    if (maps === null || (ma !== null && at === null)) {
      globe.setSeaIce(null);
      return { model: state.seaIce, mix: null };
    }
    // How far the sea had fallen towards its glacial low, by the same source.
    const source: CoastSource = COAST_SOURCES.find((id) => id === at?.series.id) ?? state.coast;
    const glacial =
      levels === null ? null : coastlineAt(levels, source, LAST_GLACIAL_MAXIMUM_MA * 1000);
    const mix = at === null ? 0 : seaIceMix(at.seaLevel, glacial?.seaLevel ?? -120);
    const season = ma === null ? seaIceSeason(momentJulianDay(state.time)) : null;
    globe.setSeaIce({ ...maps, mix, season });
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

  /** The header in deep time: how long ago, and the period by the ICS chart. */
  function showDeepTimeText(ma: number): void {
    const period = periodAt(ma);
    dateText.textContent = formatMa(ma);
    timeText.textContent = '';
    detailText.textContent = period === null ? 'Deep time' : periodWords(period);
  }

  /** Play towards the present; from today, start again at the oldest map. */
  // The speed picked for each span, this visit; each starts at its own default.
  let deepSpeeds: Partial<Record<DeepScale, number>> = {};
  /** How fast deep time plays now, millions of years a second, by the span shown. */
  function playSpeed(): number {
    const { deepScale } = store.get();
    return deepSpeedFor(deepScale, deepSpeeds[deepScale]);
  }

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
    const next = head.step(ma, playSpeed(), seconds);
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

  // Archaeological radiocarbon dates (p3k14c): the counts load with the layer, a place's tile
  // when it is picked.
  let datesHeat: DatesHeat | null = null;
  let datesHeatLoading: Promise<DatesHeat> | null = null;
  const datesTiles = new Map<string, Promise<DatesTile | null>>();
  let datesSaid: string | null = null;
  let datesAction: { readonly label: string; readonly run: () => void } | null = null;

  /** The curves, for carrying a date across one: loaded once, with or without their layer. */
  function radiocarbonCurves(): Promise<Radiocarbon> {
    return radiocarbon === null
      ? loadRadiocarbon(`${base}data/radiocarbon.json`, fetchJson).then((loaded) => {
          radiocarbon = loaded;
          return loaded;
        })
      : Promise.resolve(radiocarbon);
  }

  function datesTile(heat: DatesHeat, place: GeoPoint): Promise<DatesTile | null> {
    const key = tileKeyOf(heat, place);
    let tile = datesTiles.get(key);
    if (tile === undefined) {
      // A place with no dates nearby has no tile: none to fetch, nothing to say.
      tile = loadDatesTile(`${base}data/radiocarbon-dates/tiles/${key}.json`, fetchJson).catch(
        () => null,
      );
      datesTiles.set(key, tile);
    }
    return tile;
  }

  /** In historical time with the layer on: the squares with dates, and the place's, if picked. */
  function showDates(state: ViewState): void {
    const on = state.layers.has('dates') && state.ma === null;
    datesAction = null;
    if (!on || travelling) {
      datesSaid = on ? RESTING : null;
      datesOnGlobe.update(null);
      return;
    }
    if (datesHeat === null) {
      datesSaid = 'Loading the radiocarbon dates…';
      if (datesHeatLoading === null) {
        datesHeatLoading = loadDatesHeat(`${base}data/radiocarbon-dates/heat.json`, fetchJson);
        datesHeatLoading.then(
          (loaded) => {
            datesHeat = loaded;
            showDates(store.get());
            showEmpires(store.get());
          },
          (error: unknown) => {
            datesHeatLoading = null;
            notify(`Could not load the radiocarbon dates: ${errorMessage(error)}`);
          },
        );
      }
      return;
    }
    const heat = datesHeat;
    const year = state.time.date.year;
    const near = datesNear(heat, year);
    datesOnGlobe.update(
      near === null ? null : { cells: near.cells, cellDegrees: heat.cellDegrees },
    );
    datesSaid = datesNote(near, null);
    const place = state.location;
    if (place === null || near === null) return;
    void datesTile(heat, place).then((tile) => {
      const now = store.get();
      // Only if the view still shows this place and year.
      if (now.location !== place || now.time.date.year !== year || !now.layers.has('dates')) return;
      const here = tile === null ? { samples: [], sites: [] } : datesHere(heat, tile, place, year);
      datesSaid = datesNote(near, here);
      // The date nearest the middle of the step, to carry across the curve.
      const middle = here.samples[Math.floor(here.samples.length / 2)];
      datesAction =
        middle === undefined
          ? null
          : {
              label: 'How was a date here found?',
              run: () => {
                void radiocarbonCurves().then((curves) => {
                  const south = place.latitude < 0;
                  const what = [middle.material, middle.period].filter((word) => word !== '');
                  datingCard.open(
                    south ? curves.curves.shcal20 : curves.curves.intcal20,
                    south ? 'SHCal20' : 'IntCal20',
                    middle.age,
                    middle.error,
                    `${middle.lab || 'A sample'} from ${middle.site || 'an unnamed site'}${middle.country === '' ? '' : `, ${middle.country}`}${what.length === 0 ? '' : ` (${what.join(', ')})`}: ${String(middle.age)} ± ${String(middle.error)} radiocarbon years, from p3k14c.`,
                  );
                });
              },
            };
      showEmpires(store.get());
    });
  }

  // Rocks at the surface: their file loads the first time the layer is turned on.
  let rocks: readonly RockUnit[] | null = null;
  let rocksLoading: Promise<Rocks> | null = null;
  let rocksSaid: string | null = null;
  let rocksAction: { readonly label: string; readonly run: () => void } | null = null;

  /** In historical time with the layer on, the rocks by age, and the rock at the place picked. */
  function showRocks(state: ViewState): void {
    const on = state.layers.has('rocks') && state.ma === null;
    rocksAction = null;
    // Today's rocks say nothing of the year a trip shows: they rest with the markers.
    if (!on || travelling) {
      rocksSaid = on ? RESTING : null;
      rocksOnGlobe.update(null);
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
    rocksOnGlobe.update(rocks);
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
    if (!on) {
      waysSaid = null;
      waysShownYear = null;
      waysOnGlobe.update(null);
      waysLegend.render(null);
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
    waysLegend.render(at);
    // Repainting the map is slow: only when the moment rated changes, as the years go by.
    if (at.year === waysShownYear) return;
    waysShownYear = at.year;
    waysOnGlobe.update(at.regions);
  }
  let waysShownYear: number | null = null;

  // The layers drawn on each span, as the Layers panel has them, for what is on screen now.
  const layerSpans = new Map(
    LAYER_GROUPS.flatMap((group) => group.layers.map((layer) => [layer.id, layer.spans] as const)),
  );
  let sourcesShown = '';
  /** The Sources list: what is on screen now, drawn again only when that changes. */
  function showSources(state: ViewState): void {
    const ids: WhyId[] = onScreen({
      mode: state.mode,
      span: state.ma === null ? 'years' : state.deepScale,
      focus: state.focus,
      layers: state.layers,
      borders: state.borders,
      eclipse: state.selection !== null,
      drawsOn: (layer, span) => layerSpans.get(layer)?.includes(span) ?? false,
    });
    const key = ids.join(' ');
    if (key === sourcesShown) return;
    sourcesShown = key;
    whySheet.renderOnScreen(sourcesList, ids);
  }

  let hereShown: string | null = null;
  /** What is written about here: the passages anchored where the reader looks, when. */
  function showHere(state: ViewState): void {
    if (!hereText.open || herePassages === null) return;
    const sky = state.mode === 'sky';
    const found = nearby(herePassages, {
      body: sky ? 'earth' : state.focus,
      target: sky ? (state.location ?? state.camera.target) : state.camera.target,
      distance: sky ? 3 : state.camera.distance,
      year: state.ma === null ? state.time.date.year : null,
    });
    const key = found.map(({ passage }) => passage.id).join(' ');
    if (key === hereShown) return;
    hereShown = key;
    if (found.length === 0) {
      hereList.replaceChildren(
        element('li', { class: 'here-empty' }, 'Nothing written about here yet. Try Search.'),
      );
      return;
    }
    hereList.replaceChildren(
      ...found.map(({ passage, anchor }) => {
        const open = element(
          'button',
          { type: 'button', class: 'here-item' },
          element('span', { class: 'here-title' }, passage.title),
          element('span', { class: 'here-meta' }, anchorLabel(anchor)),
        );
        open.addEventListener('click', () => {
          openAnchor(anchor);
        });
        return element('li', { 'data-passage': passage.id }, open);
      }),
    );
  }

  // The states last drawn, for "Why here?" to read back.
  let statesDrawn: { readonly year: number; readonly territories: readonly Territory[] } | null =
    null;

  /** What each layer on the map has at the place picked: "Why here?". */
  function hereView(state: ViewState): HereView | null {
    if (state.location === null || state.ma !== null) return null;
    const year = state.time.date.year;
    const words = (y: number): string => formatYear(astronomicalYear(y));
    const shownYear = cliopatriaYear(year, PRESENT_YEAR);
    const ways = state.layers.has('ways') && waysOfLife !== null ? waysAt(waysOfLife, year) : null;
    return {
      place: placeText(state.location),
      facts: hereFacts({
        place: state.location,
        yearText: words(year),
        states: state.layers.has('empires')
          ? {
              source: state.borders,
              territories: statesDrawn?.year === year ? statesDrawn.territories : null,
              asOf: shownYear === year ? null : words(shownYear),
            }
          : null,
        ways: ways === null ? null : { at: ways, momentText: words(ways.year) },
        rock:
          state.layers.has('rocks') && rocks !== null ? rockAt(rocks, state.location) : undefined,
      }),
    };
  }

  // The moment last shown (TT), for the body bar: it works out only the body in view.
  let bodiesAt: JulianDay | null = null;
  let lastTerrestrial: number | null = null;

  /** Away from Earth: Earth's own bits rest, and the body in view shows. */
  function showBody(state: ViewState): void {
    const away = awayFromEarth(state);
    bottom.dataset['away'] = String(away);
    showCycle(state);
    // The Moon keeps the year's eclipses; Earth's other timelines rest there too (#329).
    bottom.dataset['body'] = state.focus;
    hudActions.hidden = away;
    bodies.show(state);
  }

  /** What a why says of the moment shown: deep time's map, the period's own evidence. */
  function whyMoment(id: WhyId, state: ViewState): WhyMoment | null {
    if (id !== 'deep-evidence' || state.ma === null) return null;
    const period = periodAt(state.ma);
    const evidence = period === null ? undefined : PERIOD_EVIDENCE[period.name];
    if (period === null || evidence === undefined) return null;
    return {
      title: `Then: the ${period.name}`,
      lines: [evidence.map, evidence.evidence],
      sources: evidence.sources,
    };
  }

  /** What "Here" depends on, so it is written again only when that changes. */
  function hereVersion(state: ViewState): string {
    return [
      state.location === null ? '' : placeText(state.location),
      state.time.date.year,
      [...state.layers].join(','),
      state.borders,
      statesDrawn?.year ?? '',
      waysOfLife === null ? 0 : 1,
      rocks === null ? 0 : 1,
    ].join('|');
  }

  function showEmpires(state: ViewState): void {
    // Past states belong to historical time, not deep time.
    const on = state.layers.has('empires') && state.ma === null;
    layersPanel.render({
      layers: state.layers,
      borders: state.borders,
      year: state.time.date.year,
      present: PRESENT_YEAR,
      span: state.ma === null ? 'years' : state.deepScale,
      visible: state.mode === 'globe' && !awayFromEarth(state),
      said: new Map<Layer, string>([
        ...(waysSaid === null ? [] : [['ways', waysSaid] as const]),
        ...(periodsSaid === null ? [] : [['periods', periodsSaid] as const]),
        ...(rocksSaid === null ? [] : [['rocks', rocksSaid] as const]),
        ...(datesSaid === null ? [] : [['dates', datesSaid] as const]),
        ...(impactsSaid === null ? [] : [['impacts', impactsSaid] as const]),
        ...mounted.flatMap(({ feature, shown }) => {
          const text = shown.said?.() ?? null;
          return text === null ? [] : [[feature.id, text] as const];
        }),
        ...(carbonMadeSaid === null ? [] : [['carbonMade', carbonMadeSaid] as const]),
      ]),
      actions: new Map([
        [
          'fossils',
          {
            label: 'Their tree through time',
            run: () => {
              store.set((state) => ({ ...state, lineages: { group: 'dinosaurs', pick: null } }));
            },
          },
        ] as const,
        [
          'impacts',
          {
            label: 'Their paths through time, in 3D',
            run: () => {
              store.set((state) => ({ ...state, craters: 'all' }));
            },
          },
        ] as const,
        [
          'humans',
          treeOfLife.action(
            'Our species on the tree of life',
            (tree) => tree.ours.humans['sapiens'],
          ),
        ] as const,
        ...(rocksAction === null ? [] : [['rocks', rocksAction] as const]),
        ...(datesAction === null ? [] : [['dates', datesAction] as const]),
        ...(carbonMadeAction === null ? [] : [['carbonMade', carbonMadeAction] as const]),
      ]),
    });
    const source = state.borders;
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
        statesDrawn = { year, territories: drawn };
        if (store.get().why === 'here') whySheet.show('here', hereVersion(store.get()));
        const changes = noteStates(source, year, [
          ...drawn.map((territory) => ({ ...labelPoint(territory), name: territory.name })),
          ...(lines?.labels ?? []),
        ]);
        globe.setEmpires({ territories: drawn, ohm: lines, changes });
      },
      (error: unknown) => {
        empiresShown = null;
        notify(`Could not load the borders of past states: ${errorMessage(error)}`);
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
  function bodiesSeen(state: ViewState): BodiesSeen | null {
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

  function render(state: ViewState, previous: ViewState | null): void {
    const leftDeepTime = previous !== null && previous.ma !== null && state.ma === null;
    if (state.time !== previous?.time || state.years !== previous.years || leftDeepTime) {
      showTime(state);
    } else if (lastTerrestrial !== null) {
      // Each feature is shown again, at the moment shown, when what it watches changes.
      for (const { feature, shown } of mounted) {
        if (changed(feature.watches(previous), feature.watches(state))) {
          shown.show?.(state, lastTerrestrial);
        }
      }
    }
    if (redraws(DEEP_TIME, state, previous)) showDeepTime(state);
    if (redraws(SKY, state, previous)) {
      if (state.mode === 'sky' || previous?.mode === 'sky' || previous === null) {
        globeContainer.hidden = state.mode === 'sky';
        sky.render(state);
      }
    }
    if (previous !== null && state.focus !== previous.focus) globe.setFocus(state.focus);
    bodies.render(state, previous);
    if (redraws(EARTH_LAYERS, state, previous)) {
      showDates(state);
      showWays(state);
      showRocks(state);
      showPeriods(state);
      showImpacts(state);
      showCarbonMade(state);
      showEmpires(state);
    } else if (previous !== null && state.focus !== previous.focus) {
      // The Layers panel is Earth's: it shuts on going to another body.
      showEmpires(state);
    }
    // Deep time, or an eclipse picked, ends a trip through the years.
    if (state.ma !== null || state.selection !== null) {
      stopHistory();
      setTravel(false);
    }
    // With an eclipse open, its own player runs the time; the years' slider makes way.
    zoomRail.render(
      state.mode === 'globe' && state.view === 'free' && state.ma === null
        ? { body: state.focus, distance: state.camera.distance }
        : null,
    );
    showSources(state);
    showHere(state);
    showBody(state);
    bodies.sharpen(state);
    zoomRail.setWhyHere(
      state.mode === 'globe' && state.focus === 'earth' && state.ma === null,
      askingHere,
    );
    root.classList.toggle('is-asking-here', askingHere && state.ma === null);
    if (redraws(treeOfLife.watches, state, previous)) treeOfLife.render(state);
    impactPathsSheet.show(state.craters, state.ma ?? 0, state.cratersIn);
    boundariesSheet.show(state.boundaries);
    whySheet.show(
      state.why,
      state.why === 'here'
        ? hereVersion(state)
        : state.why === 'deep-evidence' && state.ma !== null
          ? (periodAt(state.ma)?.name ?? '')
          : '',
    );
    // The time changed elsewhere (the year typed, the slider) ends the cycle's play.
    if (cyclePlaying && state.time !== cycleShown) stopCycle();
    if (redraws(HISTORY, state, previous)) showHistory(state);
    if (state.location !== previous?.location) globe.setLocation(state.location);
    if (state.view !== previous?.view) globe.setViewpoint(state.view);
    if (redraws(VIEW_SWITCH, state, previous)) {
      viewSwitch.render(state.mode, state.view, moonEphemeris !== null, state.focus);
    }
    if (state.years !== previous?.years || barYear(state) !== barYear(previous)) {
      loadYear(state);
    }
    records.render(state);
    if (redraws(SELECTION, state, previous)) {
      renderSelection(state);
    } else if (previous !== null && state.time !== previous.time) {
      renderMoment(state);
    }
    sync.update(state);
  }

  store.subscribe((state, previous) => {
    render(state, previous);
    if (redraws(FOUND_THE_WAY_IN, state, previous)) welcome.dismiss();
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
      const insets = {
        top: spans ? top.getBoundingClientRect().bottom : 0,
        bottom: bottom.getBoundingClientRect().height,
      };
      globe.setInsets(insets.top, insets.bottom);
      sky.setInsets(insets.top, insets.bottom);
      // The zoom rail sits at the right, between the panels that reach it: the date panel only
      // when it spans the width (a narrow one, beside the globe, leaves the right edge free).
      root.style.setProperty('--free-top', `${String(insets.top)}px`);
      root.style.setProperty('--free-bottom', `${String(insets.bottom)}px`);
      const free = window.innerHeight - insets.top - insets.bottom;
      zoomRail.root.classList.toggle('is-cramped', free < ZOOM_RAIL_ROOM);
      // Deep time's sheet stops short of the date panel where the two share columns (#237).
      const panel = top.getBoundingClientRect();
      const sheet = bottom.querySelector('.deep-time')?.getBoundingClientRect();
      const shared =
        sheet !== undefined &&
        sheet.width > 0 &&
        panel.right > sheet.left &&
        panel.left < sheet.right;
      root.style.setProperty('--hud-clear', `${String(shared ? panel.bottom + 8 : 0)}px`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(top);
    observer.observe(bottom);
    window.addEventListener('resize', update);
  }

  globe.onBodyClick((focus) => {
    store.set((state) => ({ ...state, focus, view: 'free' }));
  });
  globe.onEmptyTap(() => {
    // In deep time, empty space is like the globe: a tap clears the panels, or brings them back.
    // In historical time a tap on the globe picks a place, so empty space only brings them back.
    if (store.get().ma !== null) togglePanels();
    else showPanels();
  });
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
      ...(askingHere ? { why: 'here' as const } : {}),
      time:
        selected === undefined || !isSolar(selected)
          ? state.time
          : eclipseMomentAt(selected, location),
    }));
  });
  // A first visit whose link names no view of its own opens over the reader's region, from the
  // browser's time zone: read here, matched to the tz database's places, sent nowhere. The globe
  // turns there only if the reader has not moved it meanwhile.
  if (leavesViewOpen(openedSearch)) {
    const zone = browserTimeZone();
    const opened = store.get().camera;
    if (zone !== null) {
      loadTimeZones(`${base}data/timezones.json`, fetchJson).then(
        (zones) => {
          const place = placeOfZone(zones, zone);
          const state = store.get();
          // The scene reports the camera it opened with: only a real move counts as moving it.
          const moved =
            Math.abs(state.camera.target.latitude - opened.target.latitude) > 0.01 ||
            Math.abs(state.camera.target.longitude - opened.target.longitude) > 0.01 ||
            Math.abs(state.camera.distance - opened.distance) > 0.01;
          if (place === null || moved || state.focus !== 'earth') return;
          globe.flyTo(place);
        },
        () => {
          // Without the table the globe keeps its usual first view.
        },
      );
    }
  }
  /**
   * Play an impact at its place: turn the globe to it, come in close, and let it fall. The
   * approach is a study's where one exists, else the most likely angle, assumed.
   */
  function playImpact(name: string, place: GeoPoint, craterKm: number): void {
    const approach = approachOf(name);
    if (store.get().focus !== 'earth')
      store.set((state) => ({ ...state, focus: 'earth', view: 'free' }));
    globe.flyTo(place);
    globe.zoomTo(Math.min(store.get().camera.distance, 2.2));
    // Once the globe has turned to it.
    window.setTimeout(() => {
      globe.playImpact({
        place,
        craterKm,
        fromAzimuth: approach.fromAzimuth,
        angleDegrees: approach.angleDegrees,
      });
    }, 1000);
  }
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
