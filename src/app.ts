/**
 * Wires the view state (from the URL) to the globe, the timeline, the scrubber and the card.
 *
 * Browser-only glue, covered by the Playwright suite. Logic worth unit testing lives in the
 * modules it calls.
 */

import { type EquatorialVector, loadMoonEphemeris, type MoonEphemeris } from './astro/moon';
import { loadSky } from './data/sky';
import { earthFixedToJ2000, sunPositionJ2000 } from './astro/precession';
import { subsolarPoint, sunDistance } from './astro/sun';
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
import { geoToVector } from './globe/geo';
import { MOON_CAPTION, PLANET_NAMES, PLANET_PICTURES, SHARP_MAPS } from './globe/planetLook';
import { loadPolarity, type PolarityScale } from './data/polarity';
import { fieldAt, POLARITY_RECORD_MA } from './deepTime/earthState';
import { IMPACT_ANIMATION_MS } from './globe/impactAnimation';
import { createGlobe, type StateChange } from './globe/scene';
import { createStore } from './state/store';
import { parseViewState } from './state/url';
import { browserUrlWriter, createUrlSync } from './state/urlSync';
import {
  DEFAULT_CAMERA,
  DEFAULT_LOOK,
  defaultViewState,
  type DeepScale,
  EARTH_AGE_MA,
  ICE_AGES_MA,
  LAST_GLACIAL_MAXIMUM_MA,
  type BorderSource,
  type Layer,
  SKY_FOV_RANGE,
  type SkyLook,
  withLayer,
  roundMa,
  momentJulianDay,
  type GeoPoint,
  type DispersalScenario,
  type ViewState,
} from './state/viewState';
import { eclipseNote, planetNote, skyCaption } from './sky/caption';
import {
  loadPlanetEphemeris,
  ORBIT_DAYS,
  ORBITING,
  orbitPath,
  planetMagnitude,
  PLANETS,
  saturnRingTilt,
  type Orbiting,
  type PlanetEphemeris,
  type PlanetName,
} from './astro/planets';
import type { SkyPlanet } from './sky/skyScene';
import { moonSunlight, observerPosition, sunVisible, topocentric } from './sky/bodies';
import { earthVelocity, horizonMatrix, horizontalOf } from './sky/horizon';
import { LOWEST_LOOK, roundLook } from './sky/look';
import { longTermEarthFixedToJ2000 } from './astro/longTermPrecession';
import type { Vector3 } from './astro/matrix';
import type { SkyMark, SkyScene, SkyTap } from './sky/skyScene';
import { DeltaT } from './time/deltaT';
import { formatCalendar, formatDate, formatDuration, formatTimeOfDay } from './time/format';
import { julianDayNumber, type JulianDay } from './time/julianDay';
import { formatInCalendar, yearContaining, yearSpan } from './time/calendars';
import { astronomicalYear, formatYear, type AstronomicalYear } from './time/year';
import { moveToYear } from './time/yearInput';
import { element } from './ui/dom';
import { createEclipseCard } from './ui/eclipseCard';
import { createFamousPanel } from './ui/famousPanel';
import { uiIcon } from './ui/icons';
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
import { cliopatriaYear, LAYER_GROUPS } from './state/layerCatalog';
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
import {
  framesAhead,
  framesAround,
  loadPaleoDemIndex,
  oldestMa,
  type PaleoDemIndex,
} from './data/paleoDem';
import { loadPaleoTempIndex, type PaleoTempIndex } from './data/paleoTemp';
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
import { createBodyBar } from './ui/bodyBar';
import { moonFacts, moonText, planetFacts, planetText, sunText } from './astro/bodyFacts';
import { browserTimeZone, leavesViewOpen, loadTimeZones, placeOfZone } from './data/timezones';
import { approachOf, impactorText } from './data/impactScaling';
import { createWhySheet, type HereView, type WhyMoment } from './ui/whySheet';
import { PERIOD_EVIDENCE } from './sources/periodEvidence';
import { hereFacts, placeText } from './sources/here';
import { layerWhy, onScreen, type WhyId } from './sources/registry';
import { createZoomRail } from './ui/zoomRail';
import { createWaysLegend } from './ui/waysLegend';
import { loadWaysOfLife, waysAt, waysNote, type WaysOfLife } from './data/waysOfLife';
import {
  genomesNear,
  genomesNote,
  genomeCellCard,
  loadAncientGenomes,
  type AncientGenomes,
} from './data/ancientGenomes';
import { loadAtmosphere, type Atmosphere } from './data/atmosphere';
import { loadCo2Archive, type Co2Archive } from './data/co2Archive';
import { loadDeepAir, type DeepAir } from './data/deepAir';
import { fossilCard, fossilsAt, loadFossils, type Fossils } from './data/fossils';
import {
  impactDetails,
  impactsAt,
  impactsText,
  placeThen,
  loadImpacts,
  STRIKE_MIN_KM,
  strikesPassed,
  type Impact,
  type Impacts,
  type ImpactsMode,
} from './data/impacts';
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
import { deepSpeedFor } from './deepTime/playSpeed';
import { COAST_SOURCES, coastlineAt, type Coastline, type CoastSource } from './deepTime/coastline';
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
import { createPeriodBands, yearTicks } from './ui/periodBands';
import { createSpanSwitch, type Span } from './ui/spanSwitch';
import { elementAt } from './util/arrays';
import { errorMessage } from './util/errors';

const MINUTES_PER_DAY = 1440;
/** Field of view (degrees) when turning to the Sun or Moon: close enough to see the disc. */
const AIM_FOV = 12;
/** A planet tapped in the sky: a point at any zoom, so a few degrees, its neighbours in view. */
const PLANET_SKY_FOV = 4;
/** How long the sky takes to turn and close in on a tapped body, ms, before going to it. */
const SKY_GLIDE_MS = 900;
/** Within this many radii of the body in focus, its sharper map is fetched (#258). */
const SHARP_WITHIN = 2.5;
/** How high an upright phone looks on entering the sky, degrees: the horizon low in view. */
const PHONE_SKY_ALTITUDE = 12;
/** Degrees from the centre of the globe in view within which a strike is played as time runs. */
const STRIKE_IN_VIEW = 70;
/** Earth radii (or the focused body's): beyond this the space view loads the planets. */
const PLANETS_SHOWN_BEYOND = 1000;
/** Pixels the zoom rail needs between the panels: its buttons, a short track and its reading. */
const ZOOM_RAIL_ROOM = 180;
/** This year, up to which the latest borders of states carry on. */
const PRESENT_YEAR = new Date().getUTCFullYear();
/** The year “before present” counts back from, as radiocarbon dates do. */
const BP_ZERO_YEAR = 1950;

/**
 * Maps loaded ahead while deep time plays: at 20 Myr a second, about a second's worth; more at
 * a faster speed, so the globe keeps up.
 */
function prefetchFrames(maPerSecond: number): number {
  return Math.max(4, Math.ceil((4 * maPerSecond) / 20));
}
/** The elevation maps reach back this far (their index says for certain once loaded). */
const MAPS_REACH_MA = 540;

export async function startApp(root: HTMLElement): Promise<void> {
  const base = import.meta.env.BASE_URL;
  const now = new Date();
  // The link as the reader opened it, before the view is written back into it.
  const openedSearch = window.location.search;
  const parsed = parseViewState(openedSearch, now);
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

  /**
   * On a phone held upright the sky shows less from top to bottom (#253), and the panels cover
   * much of it: an untouched look is lowered so the horizon is in view. A look the reader chose,
   * or a link's, stays as it is.
   */
  function phoneLook(look: SkyLook): SkyLook {
    const untouched = look.altitude === DEFAULT_LOOK.altitude && look.fov === DEFAULT_LOOK.fov;
    if (!untouched || window.innerHeight <= window.innerWidth) return look;
    return { ...look, altitude: PHONE_SKY_ALTITUDE };
  }

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
          look: phoneLook(state.look),
        };
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
    onEarth() {
      store.set((state) => ({ ...state, focus: 'earth', view: 'free' }));
    },
  });
  const waysLegend = createWaysLegend(whySheet.mark('ways', 'Ways of life'));
  // Away from Earth, the bar's line for the body in view, in place of Earth's own.
  const bodyBar = createBodyBar(whySheet.mark('bodies', 'Sun, Moon and planets'));
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
  const deepBar = createDeepTimeBar({
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
    onCo2Archive() {
      loadArchive();
    },
    onImpactsMode(mode) {
      impactsMode = mode;
      showDeepTime(store.get());
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
  const sunSwitch = createSunSwitch(
    (sunLayer) => {
      store.set((state) => ({ ...state, sunLayer }));
    },
    whySheet.mark('sun', 'The Sun close up'),
  );
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
    element('summary', {}, 'Constellations and whose sky ', whySheet.mark('sky', 'The night sky')),
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
    uiIcon('fullView', 16),
    element('span', { class: 'icon-label' }, 'Full view'),
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
  );
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
    showGenomes(now);
    showImpacts(now);
    showVolcanoes(now);
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
  const RESTING = 'Resting while you travel through the years; back when the track closes.';

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
    [famousPanel.button, tabletPanel.button],
    [historyTrack.extras],
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
    element(
      'div',
      { class: 'holocene-bar' },
      bodyBar.root,
      waysLegend.root,
      historyTrack.root,
      timeline.root,
    ),
    deepBar.root,
  );
  root.replaceChildren(
    globeContainer,
    skyContainer,
    zoomRail.root,
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
      fullView,
      element('p', { class: 'hud-when' }, dateText, ' ', timeText),
      detailText,
      termNote,
      welcome.root,
      element('div', { class: 'hud-actions' }, historySpan.root, layersPanel.button),
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
        // What is on screen now, each with the book that says why, and its sources' links.
        sourcesList,
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
  });

  function notify(message: string): void {
    // A failure asked again (each time the view is drawn) says so once.
    if ([...notices.children].some((notice) => notice.textContent === message)) return;
    notices.append(element('li', {}, message));
  }
  parsed.warnings.forEach(notify);

  // The globe draws at once and takes its maps as they arrive; nothing below waits on them.
  const globe = createGlobe(globeContainer, {
    camera: store.get().camera,
    textureUrl: `${base}textures/earth-blue-marble-2048.jpg`,
    moonTextureUrl: `${base}textures/moon-lroc-1k.jpg`,
    focus: store.get().focus,
  });
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
    lastTerrestrial = terrestrial;
    bodiesAt = terrestrial;
    showBody(state);
    showOrbits(state, terrestrial);
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
        skyScene.onTap((tapped) => {
          // Open sky picks nothing: a tap there clears the panels, or brings them back (#253).
          if (tapped === null) {
            togglePanels();
            return;
          }
          zoomToBody(tapped);
        });
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
  /** The pole a compass pointed to then, as the globe marks it. */
  function magneticNorthAt(ma: number): 'north' | 'south' | 'either' | null {
    if (ma > POLARITY_RECORD_MA) return null;
    const { polarity: field } = fieldAt(ma, polarity);
    return field === 'normal' ? 'north' : field === 'reversed' ? 'south' : 'either';
  }

  function showDeepTime(state: ViewState): void {
    const { ma } = state;
    bottom.dataset['deep'] = ma === null ? 'off' : 'on';
    globe.setMagneticNorth(ma === null ? null : magneticNorthAt(ma));
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
      // As showTemperature has it below: none on the ice-age scale or before the maps.
      temperature: state.layers.has('temperature') && !ice && !uncharted,
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
      return { on: true, text: null, mode: impactsMode };
    }
    if (ma === null) {
      // In historical time, today's places; a crater younger than the year shown is not there.
      const since = Math.max(0, BP_ZERO_YEAR - state.time.date.year) / 1e6;
      const marks = impactsAt(impacts, since, true);
      globe.setImpacts(marks);
      impactsSaid = impactsText(impacts, marks, null);
      return { on: true, text: impactsSaid, mode: impactsMode };
    }
    // On the ice-age scale the map is today's, so the craters are where they are today.
    const placeMa = scale === 'ice' ? 0 : ma;
    const marks = impactsAt(impacts, ma, false, placeMa, impactsMode);
    globe.setImpacts(marks);
    strikeAsItPasses(state, impacts, ma, placeMa);
    impactsSaid = null;
    return { on: true, text: impactsText(impacts, marks, ma, impactsMode), mode: impactsMode };
  }

  // As deep time plays, a great impact strikes when the time passes it (#242): one at a time,
  // only on the side of the globe in view, and never for a reader who asks for less motion.
  let strikeFrom: number | null = null;
  let strikeBusyUntil = 0;
  const lessMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function strikeAsItPasses(state: ViewState, data: Impacts, ma: number, placeMa: number): void {
    const from = strikeFrom;
    strikeFrom = playing ? ma : null;
    if (from === null || !playing || lessMotion.matches || state.focus !== 'earth') return;
    if (performance.now() < strikeBusyUntil) return;
    // Of those passed since the last frame, the greatest that can be seen.
    const seen = strikesPassed(data, from, ma)
      .map((impact) => ({ impact, place: placeThen(data, impact, placeMa) }))
      .filter(
        (each): each is { impact: Impact; place: GeoPoint } =>
          each.place !== null && angularDistance(each.place, state.camera.target) < STRIKE_IN_VIEW,
      )
      .sort((a, b) => (b.impact.diameterKm ?? 0) - (a.impact.diameterKm ?? 0));
    const [greatest] = seen;
    if (greatest === undefined) return;
    const approach = approachOf(greatest.impact.name);
    strikeBusyUntil = performance.now() + IMPACT_ANIMATION_MS;
    globeContainer.dataset['strike'] = greatest.impact.name;
    globe.playImpact({
      place: greatest.place,
      craterKm: greatest.impact.diameterKm ?? STRIKE_MIN_KM,
      fromAzimuth: approach.fromAzimuth,
      angleDegrees: approach.angleDegrees,
    });
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
    if (!on || travelling) {
      volcanoesSaid = on ? RESTING : null;
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

  // The genera's pictures: loaded the first time a fossil cell's card opens.
  let fossilPictures: Pictures | null = null;
  let fossilPicturesLoading: Promise<Pictures> | null = null;
  let fossilShown: string | null = null;

  function fossilCardFor(
    key: string,
    pictures: Pictures | null,
  ): ReturnType<typeof fossilCard> | null {
    const { ma } = store.get();
    if (fossils === null || ma === null) return null;
    const at = fossilsAt(fossils, ma);
    const cell = at.cells.find(
      (each) => `fossil:${each.group}:${String(each.latitude)}:${String(each.longitude)}` === key,
    );
    return cell === undefined ? null : fossilCard(fossils, cell, at, pictures);
  }

  function showFossilCard(key: string): void {
    const card = fossilCardFor(key, fossilPictures);
    if (card === null) return;
    fossilShown = key;
    markerCard.show(card);
    if (fossilPictures !== null || fossilPicturesLoading !== null) return;
    fossilPicturesLoading = loadPictures(`${base}data/fossil-pictures.json`, fetchJson);
    fossilPicturesLoading.then(
      (loaded) => {
        fossilPictures = loaded;
        // Its picture, if its card is still the one open.
        const again = fossilShown === null ? null : fossilCardFor(fossilShown, loaded);
        if (markerCard.dialog.open && again !== null) markerCard.show(again);
      },
      (error: unknown) => {
        fossilPicturesLoading = null;
        notify(`Could not load the fossils’ pictures: ${errorMessage(error)}`);
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
    fossilShown = null;
    if (kind === 'volcano' && id !== undefined) {
      showVolcanoCard(id);
      return;
    }
    if (kind === 'human' && id !== undefined) {
      showHumanCard(id);
      return;
    }
    if (kind === 'fossil') {
      showFossilCard(key);
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
      globe.setShelf(null);
      globe.setIce(null);
      return;
    }
    const ka = kaBeforePresent(state.time.date.year);
    const levels = seaLevels();
    const shelf = shelves();
    const coastline = levels === null ? null : coastlineAt(levels, state.coast, ka);
    holoceneSea = coastline;
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
    if (playing) {
      globe.prefetch(
        framesAhead(index.frames, ma, prefetchFrames(playSpeed())).map(
          (frame) => `${base}data/${folder}/${frame.file}`,
        ),
      );
    }
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

  // Ancient genomes: their file loads the first time the layer is turned on.
  let ancientGenomes: AncientGenomes | null = null;
  let ancientGenomesLoading: Promise<AncientGenomes> | null = null;
  let genomesSaid: string | null = null;

  /** In historical time with the layer on, the regions with genomes dated near the year. */
  function showGenomes(state: ViewState): void {
    const on = state.layers.has('genomes') && state.ma === null;
    if (!on || travelling) {
      genomesSaid = on ? RESTING : null;
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
    rocksAction = null;
    // Today's rocks say nothing of the year a trip shows: they rest with the markers.
    if (!on || travelling) {
      rocksSaid = on ? RESTING : null;
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
      globe.setWays(null);
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
    globe.setWays(at.regions);
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

  /**
   * Close up, a sharper map for the body in focus, fetched once (#258): Earth's largest only
   * where the graphics hold it and the screen is not a phone's, whose memory it would strain.
   */
  const largeMaps = globe.maxTextureSize >= 8192 && !window.matchMedia('(pointer: coarse)').matches;
  function sharpenClose(state: ViewState): void {
    if (state.mode !== 'globe' || state.ma !== null || state.camera.distance > SHARP_WITHIN) return;
    const { focus } = state;
    if (focus === 'earth' || focus === 'moon') {
      const sizes = SHARP_MAPS[focus];
      globe.setBodyMap(focus, `${base}${largeMaps ? sizes.large : sizes.small}`);
      return;
    }
    if (focus === 'sun') return;
    const { sharp } = PLANET_PICTURES[focus];
    if (sharp !== null) globe.setPlanetMap(focus, `${base}${sharp}`, true);
  }

  /** Away from Earth: the body in view and what can be said of it; Earth's own bits rest. */
  function showBody(state: ViewState): void {
    const away = state.mode === 'globe' && state.focus !== 'earth' && state.ma === null;
    bottom.dataset['away'] = String(away);
    if (!away || bodiesAt === null) {
      bodyBar.render(null);
      return;
    }
    const jdTT = bodiesAt;
    const sunKm = sunPositionJ2000(jdTT);
    const focus = state.focus;
    if (focus === 'sun') {
      bodyBar.render({ name: 'The Sun', text: sunText(sunDistance(jdTT)) });
    } else if (focus === 'moon') {
      const moonKm = moonEphemeris?.position(jdTT) ?? null;
      bodyBar.render(
        moonKm === null
          ? null
          : { name: 'The Moon', text: moonText(moonFacts(moonKm, sunKm)), picture: MOON_CAPTION },
      );
    } else {
      // A mission's map, fetched the first time the planet is looked at close up.
      const { map, caption } = PLANET_PICTURES[focus];
      if (map !== null) globe.setPlanetMap(focus, `${base}${map}`);
      const position = planets?.position(focus, jdTT);
      bodyBar.render(
        position === undefined
          ? null
          : {
              name: PLANET_NAMES[focus],
              text: planetText(planetFacts(focus, position, sunKm)),
              picture: caption,
            },
      );
    }
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
      visible: state.mode === 'globe',
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

  // Each orbit as last drawn, and the day it was centred on: drawn again only once the body has
  // gone a quarter of the way round, as summing the series 128 times a body takes a while.
  let orbitCache: Partial<Record<Orbiting, { jdTT: number; path: readonly EquatorialVector[] }>> =
    {};
  let orbitsDrawn: string | null = null;
  let lastTerrestrial: number | null = null;
  /** With the layer on and the view far enough out, the orbits around the Sun. */
  function showOrbits(state: ViewState, jdTT: number): void {
    zoomRail.setOrbits(wantPlanets(state) && state.ma === null, state.layers.has('orbits'));
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

  // A body tapped in the sky: the view turns to it and closes in, then goes to it up close. The
  // look is kept, so the way back to the sky faces the body.
  let skyGlide = 0;
  function zoomToBody({ body, azimuth, altitude, radius }: SkyTap): void {
    const look = roundLook({
      azimuth,
      altitude: Math.max(LOWEST_LOOK, altitude),
      fov: radius > 0 ? Math.max(SKY_FOV_RANGE.min, radius * 4) : PLANET_SKY_FOV,
    });
    const glide = (skyGlide += 1);
    store.set((state) => ({ ...state, look }));
    void skyScene?.glideTo(look, SKY_GLIDE_MS).then(() => {
      // Another tap, a drag or leaving the sky meanwhile cancels the way there.
      if (glide !== skyGlide || store.get().mode !== 'sky') return;
      const { look: now } = store.get();
      if (now.azimuth !== look.azimuth || now.altitude !== look.altitude || now.fov !== look.fov)
        return;
      store.set((state) => ({ ...state, mode: 'globe', focus: body, view: 'free' }));
    });
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
    // The orbits come and go as the view moves out and in, or turns to the Sun or a planet.
    if (
      lastTerrestrial !== null &&
      (state.layers !== previous?.layers ||
        state.camera !== previous.camera ||
        state.focus !== previous.focus ||
        state.mode !== previous.mode ||
        state.ma !== previous.ma)
    ) {
      showOrbits(state, lastTerrestrial);
    }
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
      state.deepScale !== previous.deepScale ||
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
    showBody(state);
    sharpenClose(state);
    zoomRail.setWhyHere(
      state.mode === 'globe' && state.focus === 'earth' && state.ma === null,
      askingHere,
    );
    root.classList.toggle('is-asking-here', askingHere && state.ma === null);
    whySheet.show(
      state.why,
      state.why === 'here'
        ? hereVersion(state)
        : state.why === 'deep-evidence' && state.ma !== null
          ? (periodAt(state.ma)?.name ?? '')
          : '',
    );
    historyTrack.root.hidden = state.selection !== null;
    historyTrack.extras.hidden = state.selection !== null;
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
      // The zoom rail sits at the right, between the panels that reach it: the date panel only
      // when it spans the width (a narrow one, beside the globe, leaves the right edge free).
      root.style.setProperty('--free-top', `${String(panelInsets.top)}px`);
      root.style.setProperty('--free-bottom', `${String(panelInsets.bottom)}px`);
      const free = window.innerHeight - panelInsets.top - panelInsets.bottom;
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
