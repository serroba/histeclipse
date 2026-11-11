/**
 * Wires the view state (from the URL) to the globe, the timeline, the scrubber and the card.
 * Browser-only glue, covered by the Playwright suite. Logic worth unit testing lives in the
 * modules it calls.
 */

import { loadMoonEphemeris, type MoonEphemeris } from './astro/moon';
import { earthFixedToJ2000, sunPositionJ2000 } from './astro/precession';
import { subsolarPoint } from './astro/sun';
import { greatestEclipseUT, yearOf } from './data/catalog';
import { famousFor, type FamousEclipse } from './data/famousEclipses';
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
import { magneticNorthLayer } from './globe/magneticNorthLayer';
import { geoToVector } from './globe/geo';
import { loadPolarity, type PolarityScale } from './data/polarity';
import { magneticNorthAt } from './deepTime/earthState';
import { loadRadiocarbon, type Radiocarbon } from './data/radiocarbon';
import { eruptionsBetween, loadEruptions, type Eruptions } from './data/eruptions';
import { RADIOCARBON_EVENTS } from './data/radiocarbonEvents';
import { createDatingCard } from './ui/datingCard';
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
import { observerPosition } from './sky/bodies';
import { longTermEarthFixedToJ2000 } from './astro/longTermPrecession';
import { DeltaT } from './time/deltaT';
import { formatCalendar, formatDate, formatDuration, formatTimeOfDay } from './time/format';
import { julianDayNumber, type JulianDay } from './time/julianDay';
import { formatInCalendar, yearContaining, yearSpan } from './time/calendars';
import { astronomicalYear, formatYear, type AstronomicalYear } from './time/year';
import { moveToYear } from './time/yearInput';
import { element } from './ui/dom';
import { createEclipseCard } from './ui/eclipseCard';
import { FEATURES } from './features';
import { RESTING, type DeepMoment, type FeatureContext } from './features/feature';
import { createSearchPanel } from './ui/searchPanel';
import { anchorLabel, anchorQuery } from './text/anchors';
import { loadMeaningSearch } from './text/meaningLoader';
import { nearby } from './text/nearby';
import { cachedPassages, type Anchor, type Passage } from './text/passages';
import { indexPassages } from './text/wordSearch';
import { uiIcon } from './ui/icons';
import { createWelcome } from './ui/welcome';
import { createMarkerCard } from './ui/markerCard';
import { createScrubber, SCRUB_RANGE_MINUTES } from './ui/scrubber';
import { createLayersPanel } from './ui/layersPanel';
import { createDeepGlance } from './ui/deepGlance';
import { cliopatriaYear, LAYER_GROUPS } from './state/layerCatalog';
import {
  blankText,
  changesText,
  createHistoryTrack,
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
import { createDeepTimeBar, type DeepTimeView } from './ui/deepTimeBar';
import type { DeepChipView } from './ui/deepChips';
import { formatMa, periodAt, periodWords } from './deepTime/periods';
import {
  framesAhead,
  framesAround,
  loadPaleoDemIndex,
  oldestMa,
  type PaleoDemIndex,
} from './data/paleoDem';
import { HOLOCENE_MA, maOfYear, yearOfMa } from './data/iceSheets';
import { countryRings, loadNamedPeriods } from './data/namedPeriods';
import { rockAt } from './data/rocks';
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
import { mountCycle } from './features/cycle';
import { mountFamous } from './features/famous';
import { mountShower } from './features/shower';
import { mountCarbonMade } from './features/carbonMade';
import { mountIceAges } from './features/iceAges';
import { mountDeepSurfaces } from './features/deepSurfaces';
import { mountRocks } from './features/rocks';
import { mountWays } from './features/ways';
import { mountDates } from './features/dates';
import { mountPeriods } from './features/periods';
import { phoneLook, type BodiesSeen } from './sky/aim';
import { PERIOD_EVIDENCE } from './sources/periodEvidence';
import { hereFacts, placeText } from './sources/here';
import { layerWhy, onScreen, type WhyId } from './sources/registry';
import { createZoomRail } from './ui/zoomRail';
import { createWaysLegend } from './ui/waysLegend';
import { waysAt } from './data/waysOfLife';
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
import { deepSpeedFor, prefetchFrames } from './deepTime/playSpeed';
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
  // Named periods for the place picked (#446).
  const namedPeriods = mountPeriods({
    ...partContext,
    refresh: () => {
      showEmpires(store.get());
    },
  });
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
        namedPeriods.loaded() ??
          namedPeriods.loading() ??
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
        surfaces.loadArchive();
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
  // The famous eclipses, and going to one (#447).
  const famous = mountFamous({
    ...partContext,
    eclipsesInYear: (kind, year) =>
      (kind === 'solar' ? solarCatalog : lunarCatalog).eclipsesInYear(year),
    flyToPicked(place) {
      flyToSelection = true;
      flyTarget = place;
    },
    loaded: () => {
      renderSelection(store.get());
    },
    openTablet: () => {
      records.open();
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
    famous.button.click();
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
  // The shower's story (#269, #317): its stage, and its chapters in 3D over the globe.
  const shower = mountShower({
    ...partContext,
    globe,
    closeLayers: () => {
      layersPanel.dialog.close();
    },
  });
  // Where cosmic rays make carbon-14 (#269): a glow over the globe, and its card.
  const carbonMade = mountCarbonMade({
    ...partContext,
    globe,
    watchShower: (dipole, fromSun) => {
      shower.watch(dipole, fromSun);
    },
    refresh: () => {
      showEmpires(store.get());
    },
  });
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
  // Away from Earth and the Moon, the bar's time is the body's own cycle as Earth sees it (#447).
  const cycle = mountCycle({
    ...partContext,
    planets: () => bodies.planets(),
    loadPlanets: () => bodies.loadPlanets(),
    moment: () => bodiesAt,
    universalTime: (jdTT) => deltaT.universalTime(jdTT),
    hideHistory(hidden) {
      historyTrack.root.hidden = hidden;
      historyTrack.extras.hidden = hidden;
    },
    stopHistory,
  });

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
    dates.show(now);
    showImpacts(now);
    if (lastTerrestrial !== null) showFeatures(now, lastTerrestrial);
    rocks.show(now);
    showEmpires(now);
    iceAges.showHolocene(now);
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
      earth: iceAges.holoceneText(),
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
    [famous.button, records.button],
    [historyTrack.extras, cycle.extras],
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
      cycle.root,
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
    famous.dialog,
    searchPanel.dialog,
    records.dialog,
    layersPanel.dialog,
    markerCard.dialog,
    datingCard.dialog,
    carbonMade.dialog,
    shower.container,
    shower.stage,
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
  // History's maps (#446): rocks, ways of life and dated squares, their layers in this order.
  const historyLayer = {
    ...partContext,
    globe,
    travelling: () => travelling,
    refresh: () => {
      showEmpires(store.get());
    },
  };
  const rocks = mountRocks({
    ...historyLayer,
    oldest: () => oldest,
    enterDeepTime: (ma, scale) => {
      enterDeepTime(ma, scale);
    },
  });
  const ways = mountWays({ ...historyLayer, legend: waysLegend });
  const dates = mountDates({ ...historyLayer, radiocarbonCurves, datingCard });
  // Deep time's climate and continents (#444): the temperature, the plates and how far they
  // moved, and the air.
  const surfaces = mountDeepSurfaces({
    ...partContext,
    globe,
    redraw: () => {
      showDeepTime(store.get());
    },
  });
  // The ice ages' Earth (#444): the sea's level and the land it left bare, the ice sheets and
  // their outlines, the sea ice, and the Holocene's while travelling through the years.
  const iceAges = mountIceAges({
    ...partContext,
    globe,
    travelling: () => travelling,
    redraw: () => {
      showDeepTime(store.get());
    },
    holoceneShown: (state) => {
      showHistory(state);
    },
  });
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
  famous.load();

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
    const famousHere = famousFor(famous.list(), state.selection);
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
      surfaces.off();
      iceAges.off(state);
      for (const { shown } of mounted) shown.deep?.(state, null);
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
    const reconstructed = ma <= (surfaces.platesReach() ?? PLATES_REACH_MA);
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
      ...iceAges.bar(state, ma),
      chips: deepChips(state, { ma, scale }),
      impacts: showImpacts(state),
      ...surfaces.bar(state, ma),
      temperature: temperatureLayer.view(state, { ma, ice, uncharted }),
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

  /** The curves, for carrying a date across one: loaded once, with or without their layer. */
  function radiocarbonCurves(): Promise<Radiocarbon> {
    return radiocarbon === null
      ? loadRadiocarbon(`${base}data/radiocarbon.json`, fetchJson).then((loaded) => {
          radiocarbon = loaded;
          return loaded;
        })
      : Promise.resolve(radiocarbon);
  }

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

  /** The rock at a place, once the rocks are in; undefined until then. */
  function rockOf(place: GeoPoint): ReturnType<typeof rockAt> | undefined {
    const units = rocks.units();
    return units === null ? undefined : rockAt(units, place);
  }

  /** What each layer on the map has at the place picked: "Why here?". */
  function hereView(state: ViewState): HereView | null {
    if (state.location === null || state.ma !== null) return null;
    const year = state.time.date.year;
    const words = (y: number): string => formatYear(astronomicalYear(y));
    const shownYear = cliopatriaYear(year, PRESENT_YEAR);
    const waysOfLife = ways.data();
    const waysThen =
      state.layers.has('ways') && waysOfLife !== null ? waysAt(waysOfLife, year) : null;
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
        ways: waysThen === null ? null : { at: waysThen, momentText: words(waysThen.year) },
        rock: state.layers.has('rocks') ? rockOf(state.location) : undefined,
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
    cycle.show(state);
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
      ways.data() === null ? 0 : 1,
      rocks.units() === null ? 0 : 1,
    ].join('|');
  }

  function showEmpires(state: ViewState): void {
    const waysSaid = ways.said();
    const periodsSaid = namedPeriods.said();
    const rocksSaid = rocks.said();
    const datesSaid = dates.said();
    const rocksAction = rocks.action();
    const datesAction = dates.action();
    const carbonSaid = carbonMade.said();
    const carbonAction = carbonMade.action();
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
        ...(carbonSaid === null ? [] : [['carbonMade', carbonSaid] as const]),
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
        ...(carbonAction === null ? [] : [['carbonMade', carbonAction] as const]),
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
      dates.show(state);
      ways.show(state);
      rocks.show(state);
      namedPeriods.show(state);
      showImpacts(state);
      carbonMade.show(state);
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
    cycle.render(state);
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
