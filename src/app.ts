/**
 * Wires the view state (from the URL) to the globe, the timeline, the scrubber and the card.
 * Browser-only glue, covered by the Playwright suite. Logic worth unit testing lives in the
 * modules it calls.
 */

import { LunarCatalog } from './data/lunarCatalog';
import { SolarCatalog } from './data/solarCatalog';
import { angularDistance } from './eclipses/visibility';
import { impactLayer } from './globe/impactLayer';
import { createDatingCard } from './ui/datingCard';
import { createGlobe } from './globe/scene';
import {
  DEEP_TIME,
  drawAll,
  EARTH_LAYERS,
  FOCUS,
  FOUND_THE_WAY_IN,
  HISTORY,
  LAYERS_PANEL,
  LOCATION,
  momentChanged,
  momentKept,
  on,
  onChange,
  SKY_SHOWN,
  VIEW_SWITCH,
  VIEWPOINT,
  type Drawn,
} from './state/redraws';
import { createStore } from './state/store';
import { parseViewState, serializeViewState } from './state/url';
import { browserUrlWriter, createUrlSync } from './state/urlSync';
import { awayFromEarth, withLayer, type GeoPoint, type ViewState } from './state/viewState';
import { DeltaT } from './time/deltaT';
import { element } from './ui/dom';
import { FEATURES } from './features';
import { mountFeatures } from './features/mounted';
import { RESTING, type FeatureContext } from './features/feature';
import { anchorQuery } from './text/anchors';
import { type Anchor } from './text/passages';
import { createWelcome } from './ui/welcome';
import { createMarkerCard } from './ui/markerCard';
import { createViewSwitch } from './ui/viewSwitch';
import { type DeepTimeView } from './ui/deepTimeBar';
import { countryRings, loadNamedPeriods } from './data/namedPeriods';
import { approachOf, impactorText } from './data/impactScaling';
import { createWhySheet } from './ui/whySheet';
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
import { mountEmpires } from './features/empires';
import { mountDeepTime } from './features/deepTime';
import { mountYears } from './features/years';
import { mountEclipses } from './features/eclipses';
import { mountTexts } from './features/texts';
import {
  hereVersion,
  hereView,
  whyMoment,
  whyVersion,
  type HereData,
} from './features/whyHere/facts';
import { createSourcesList } from './features/whyHere/sources';
import { createAsking } from './features/whyHere/asking';
import { mountMoment } from './features/moment';
import { mountLayersPanel } from './features/layersPanel';
import { createPanels } from './features/shell/panels';
import { keepCentred } from './features/shell/layout';
import { openOverRegion } from './features/shell/firstView';
import { listenForInput } from './features/shell/input';
import { bodiesSeen, namedPlace, observerOf, placeName } from './features/moment/observer';
import { createZoomRail } from './ui/zoomRail';
import { railView } from './ui/railView';
import { createWaysLegend } from './ui/waysLegend';
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
import { createTemperatureLayer } from './features/temperature/temperatureLayer';
import { errorMessage } from './util/errors';
/** Degrees from the centre of the globe in view within which a strike is played as time runs. */
const STRIKE_IN_VIEW = 70;
/** Strikes started in one frame at most, the greatest first, when time runs fast past several. */
const STRIKES_AT_ONCE = 4;
/** The year “before present” counts back from, as radiocarbon dates do. */
const BP_ZERO_YEAR = 1950;

export async function startApp(root: HTMLElement): Promise<void> {
  const base = import.meta.env.BASE_URL;
  const now = new Date();
  // The link as the reader opened it, before the view is written back into it.
  const openedSearch = window.location.search;
  const parsed = parseViewState(openedSearch, now);
  const store = createStore<ViewState>(parsed.state);
  const fetchJson = (url: string): Promise<Response> => fetch(url);
  // Full view: the panels hidden for a clear view, and the ways to bring them back.
  const panels = createPanels(root);

  const viewSwitch = createViewSwitch((choice) => {
    input.choose(choice);
  });
  // The orbits, offered where they mean something: far out, or on the Sun or a planet.
  // Why anything is on screen: the book marks beside things, and the panel they open.
  // The panel follows the view, so the link names the why open and opens it again.
  const whySheet = createWhySheet(
    (why) => {
      asking.sheetChanged(why);
      store.set((state) => ({ ...state, why }));
    },
    () => hereView(store.get(), hereData()),
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
      deepTime.enterDeepTime(ma, 'all');
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
      showLayers(store.get());
    },
  });
  // The sky view (#448): loaded the first time it is opened.
  const sky = mountSky({
    ...partContext,
    bodiesSeen: (state) => bodiesSeen(state, (jd) => deltaT.terrestrialTime(jd), bodies.moon()),
    planetsSeen: (jdTT, sun, observer) => bodies.planetsSeen(jdTT, sun, observer),
    loadPlanets: () => bodies.loadPlanets(),
    deltaTUncertainty: (jdUT) => deltaT.uncertaintySeconds(jdUT),
    namedPlace,
    moonReady: () => bodies.moon() !== null,
    togglePanels: panels.toggle,
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
  // The Sources list: the whys of what is on screen now.
  const sources = createSourcesList(whySheet);
  // The Layers panel (#451): what each layer says and offers, as the parts have it now.
  const layersPanel = mountLayersPanel({
    ...partContext,
    goToSpan: (span) => {
      deepTime.goToSpan(span);
    },
    enterDeepTime: (ma, scale) => {
      deepTime.enterDeepTime(ma, scale);
    },
    setScale: (scale) => {
      deepTime.setScale(scale);
    },
    said: () => [
      ['ways', ways.said()],
      ['periods', namedPeriods.said()],
      ['rocks', rocks.said()],
      ['dates', dates.said()],
      ['impacts', impactsSaid],
      ...features.said(),
      ['carbonMade', carbonMade.said()],
    ],
    actions: () => [
      [
        'fossils',
        {
          label: 'Their tree through time',
          run: () => {
            store.set((state) => ({ ...state, lineages: { group: 'dinosaurs', pick: null } }));
          },
        },
      ],
      [
        'impacts',
        {
          label: 'Their paths through time, in 3D',
          run: () => {
            store.set((state) => ({ ...state, craters: 'all' }));
          },
        },
      ],
      [
        'humans',
        treeOfLife.action('Our species on the tree of life', (tree) => tree.ours.humans['sapiens']),
      ],
      ['rocks', rocks.action()],
      ['dates', dates.action()],
      ['carbonMade', carbonMade.action()],
    ],
  });
  const markerCard = createMarkerCard();
  // How far out the view is, and that zooming out reaches the planets: from whichever body is
  // in focus, in the years (deep time leaves the Sun, Moon and planets out).
  const zoomRail = createZoomRail({
    onZoom(distance) {
      globe.zoomTo(distance);
    },
    onWhyHere() {
      asking.toggle();
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
  // "Why here?": while on, a tap on the globe says what each layer has there.
  const asking = createAsking({ store, zoomRail, root });
  const waysLegend = createWaysLegend(whySheet.mark('ways', 'Ways of life'));
  const globeContainer = element('div', { class: 'globe', 'data-testid': 'globe' });
  // The globe draws at once and takes its maps as they arrive; nothing below waits on them.
  // It sizes itself once its container is on the page.
  const globe = createGlobe(globeContainer, {
    camera: store.get().camera,
    textureUrl: `${base}textures/earth-blue-marble-2048.jpg`,
    moonTextureUrl: `${base}textures/moon-lroc-1k.jpg`,
    focus: store.get().focus,
  });
  // Deep time (#445): its span and moment, playing through it, its bar and glance, Earth's
  // surface from the elevation maps and magnetic north.
  // The temperature maps in deep time (#457).
  const temperatureLayer = createTemperatureLayer({
    dataUrl: (path) => `${base}data/${path}`,
    fetchJson,
    globe,
    notify,
    arrived: () => {
      deepTime.show(store.get());
    },
  });

  const deepTime = mountDeepTime({
    ...partContext,
    globe,
    chips: FEATURES.flatMap((feature) =>
      feature.deepChip === undefined ? [] : [{ layer: feature.id, ...feature.deepChip }],
    ),
    step: () => {
      sync.step();
    },
    marked: (on) => {
      bottom.dataset['deep'] = on ? 'on' : 'off';
    },
    header: (ma) => {
      moment.deepHeader(ma);
    },
    bar: (state, moment) => ({
      ...iceAges.bar(state, moment.ma),
      chips: features.deep(state, moment),
      impacts: showImpacts(state),
      ...surfaces.bar(state, moment.ma),
    }),
    temperature: temperatureLayer,
    off: (state) => {
      surfaces.off();
      iceAges.off(state);
      features.deepOff(state);
    },
    platesReach: () => surfaces.platesReach(),
    loadArchive: () => {
      surfaces.loadArchive();
    },
    impactsMode: (mode) => {
      impactsMode = mode;
    },
  });
  // A tablet's records checked against the sky, and looked at from Babylon (#447).
  const records = mountRecords({
    ...partContext,
    moon: () => bodies.moon(),
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
      eclipses.flyToPicked(place);
    },
    loaded: () => {
      eclipses.renderSelection(store.get());
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
    refresh: () => {
      moment.show(store.get());
    },
    moonArrived: () => {
      const now = store.get();
      moment.show(now);
      viewSwitch.render(now.mode, now.view, true, now.focus);
      sky.render(now);
    },
  });
  // The moment shown (#451): the header's date line, and what is placed by the moment.
  const moment = mountMoment({
    ...partContext,
    globe,
    now,
    deltaT: () => deltaT,
    moon: () => bodies.moon(),
    planetPositions: (jdTT) => bodies.planetPositions(jdTT),
    atMoment: (state, terrestrial) => {
      bodies.setMoment(terrestrial);
      showBody(state);
      bodies.showOrbits(state, terrestrial);
      features.show(state, terrestrial);
    },
    subsolar: (point) => {
      root.dataset['subsolar'] = point;
    },
  });
  // A first visit (no link to follow, never welcomed before) gets one line on what this is and
  // where to start; it goes for good once closed, followed, or once something is picked.
  const welcome = createWelcome(window.location.search === '', () => {
    famous.button.click();
  });
  const notices = element('ul', { class: 'notices', role: 'status', 'aria-live': 'polite' });
  // The panels hide for a clear view, by this button or a tap on empty space; it brings them back.
  // The site's texts (#391, #392): search, and what is written about here.
  const texts = mountTexts({
    ...partContext,
    openAnchor: (anchor) => {
      openAnchor(anchor);
    },
  });
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
      showLayers(store.get());
    },
  });
  // The years (#446): the track, playing them, travelling through them, and carbon-14 in the air.
  const years = mountYears({
    ...partContext,
    globe,
    datingCard,
    firstYear: () => deltaT.firstYear,
    travelChanged: (now) => {
      dates.show(now);
      showImpacts(now);
      const terrestrial = moment.terrestrial();
      if (terrestrial !== null) features.show(now, terrestrial);
      rocks.show(now);
      showLayers(now);
      iceAges.showHolocene(now);
    },
    statesSaid: () => empires.said(),
    holoceneText: () => iceAges.holoceneText(),
  });
  // Away from Earth and the Moon, the bar's time is the body's own cycle as Earth sees it (#447).
  const cycle = mountCycle({
    ...partContext,
    planets: () => bodies.planets(),
    loadPlanets: () => bodies.loadPlanets(),
    moment: () => moment.terrestrial(),
    universalTime: (jdTT) => deltaT.universalTime(jdTT),
    hideHistory(hidden) {
      years.track.root.hidden = hidden;
      years.track.extras.hidden = hidden;
    },
    stopHistory: () => {
      years.stop();
    },
  });

  // The borders of past states (#446), a century's file at a time, and what changed.
  const empires = mountEmpires({
    ...partContext,
    globe,
    noted: () => {
      years.show(store.get());
    },
    drawn: () => {
      if (store.get().why === 'here') whySheet.show('here', hereVersion(store.get(), hereData()));
    },
  });

  // The eclipses (#447): the year's on the bar, picking one, and the moment shown of it.
  const eclipses = mountEclipses({
    ...partContext,
    globe,
    catalogs: () => ({ lunar: lunarCatalog, solar: solarCatalog }),
    deltaT: () => deltaT,
    famous: () => famous.list(),
    placeName,
    territoryOf: (name, shown) => empires.territoryOf(name, shown),
    centuryFor: (year) => empires.centuryFor(year),
    timelineButtons: [famous.button, records.button],
    timelineExtras: [years.track.extras, cycle.extras],
  });

  const hudTools = [boundariesSheet.button, texts.search.button, panels.fullView];
  // Earth's spans and its map's layers; away from Earth they rest (#329).
  const hudActions = element(
    'div',
    { class: 'hud-actions' },
    deepTime.spanSwitch,
    layersPanel.button,
  );
  const bottom = element(
    'div',
    { class: 'bottom', 'data-deep': 'off' },
    eclipses.card,
    eclipses.scrubber,
    element(
      'div',
      { class: 'holocene-bar' },
      bodies.bar,
      waysLegend.root,
      years.track.root,
      cycle.root,
      eclipses.timeline,
    ),
    deepTime.bar,
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
      element('p', { class: 'hud-when' }, moment.dateText, ' ', moment.timeText),
      moment.detailText,
      moment.termNote,
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
          sources.list,
        ),
        texts.here,
      ),
    ),
    notices,
    deepTime.glance,
    panels.showControls,
    bottom,
    famous.dialog,
    texts.search.dialog,
    records.dialog,
    layersPanel.dialog,
    markerCard.dialog,
    datingCard.dialog,
    carbonMade.dialog,
    shower.container,
    shower.stage,
  );

  /** Open a passage's anchor: its view laid over the reader's, as a step back can undo. */
  function openAnchor(anchor: Anchor): void {
    const next = parseViewState(anchorQuery(anchor, serializeViewState(store.get())), new Date());
    deepTime.stopPlay();
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
  // History's maps (#446): rocks, ways of life and dated squares, their layers in this order.
  const historyLayer = {
    ...partContext,
    globe,
    travelling: () => years.travelling(),
    refresh: () => {
      showLayers(store.get());
    },
  };
  const rocks = mountRocks({
    ...historyLayer,
    oldest: () => deepTime.oldest(),
    enterDeepTime: (ma, scale) => {
      deepTime.enterDeepTime(ma, scale);
    },
  });
  const ways = mountWays({ ...historyLayer, legend: waysLegend });
  const dates = mountDates({
    ...historyLayer,
    radiocarbonCurves: () => years.curves(),
    datingCard,
  });
  // Deep time's climate and continents (#444): the temperature, the plates and how far they
  // moved, and the air.
  const surfaces = mountDeepSurfaces({
    ...partContext,
    globe,
    redraw: () => {
      deepTime.show(store.get());
    },
  });
  // The ice ages' Earth (#444): the sea's level and the land it left bare, the ice sheets and
  // their outlines, the sea ice, and the Holocene's while travelling through the years.
  const iceAges = mountIceAges({
    ...partContext,
    globe,
    travelling: () => years.travelling(),
    redraw: () => {
      deepTime.show(store.get());
    },
    holoceneShown: (state) => {
      years.show(state);
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
    moon: () => bodies.moon(),
    loadPlanets: () => {
      void bodies.loadPlanets();
    },
    openLineages: treeOfLife.openLineagesAt,
    openTree: treeOfLife.openTreeAt,
    change: (update) => {
      store.set(update);
    },
    travelling: () => years.travelling(),
    refresh: () => {
      const now = store.get();
      moment.show(now);
      if (now.ma !== null) deepTime.show(now);
      showLayers(now);
    },
  };
  const features = mountFeatures(FEATURES, featureContext);
  const [deltaT, lunarCatalog, solarCatalog] = await Promise.all([
    DeltaT.load(`${base}data/delta-t.json`, (url) => fetch(url)),
    LunarCatalog.load(`${base}data/lunar/`, (url) => fetch(url)),
    SolarCatalog.load(`${base}data/solar/`, (url) => fetch(url)),
  ]);
  const sync = createUrlSync(browserUrlWriter(window.location, window.history));

  // The Moon's theory is a separate chunk; until it arrives the space view shows only the Sun.
  bodies.loadMoon();

  // The famous list is a convenience: if it fails to load, everything else still works.
  famous.load();

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
      ma !== null && state.deepScale === 'all' && ma > deepTime.oldest() ? 'eons' : state.deepScale;
    const on =
      state.layers.has('impacts') && state.mode === 'globe' && (ma === null || scale !== 'eons');
    if (!on || (years.travelling() && ma === null)) {
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
              deepTime.show(now);
              return;
            }
            showImpacts(now);
            showLayers(now);
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
    strikeFrom = deepTime.playing() ? ma : null;
    if (from === null || !deepTime.playing() || lessMotion.matches || state.focus !== 'earth')
      return;
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
    if (features.pick(key)) return;
    const [kind, id] = key.split(':');
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

  /** What the layers have loaded, for "Why here?" to read. */
  function hereData(): HereData {
    return { drawn: empires.drawn(), waysOfLife: ways.data(), rocks: rocks.units() };
  }

  /** The sky, entered or left: the globe makes way for it. */
  function showSky(state: ViewState): void {
    globeContainer.hidden = state.mode === 'sky';
    sky.render(state);
  }

  /** The sheets the view names open: the impacts' paths, the boundaries, and the why. */
  function showSheets(state: ViewState): void {
    impactPathsSheet.show(state.craters, state.ma ?? 0, state.cratersIn);
    boundariesSheet.show(state.boundaries);
    whySheet.show(state.why, whyVersion(state, hereData));
  }

  /** The views offered: the Moon's own once its theory has arrived. */
  function showViewSwitch(state: ViewState): void {
    viewSwitch.render(state.mode, state.view, bodies.moon() !== null, state.focus);
  }

  /** The Layers panel, and the borders it turns on. */
  function showLayers(state: ViewState): void {
    layersPanel.show(state);
    empires.show(state);
  }

  // What is drawn as the view changes, in this order (#474): each when what it watches changes.
  const drawn: readonly Drawn[] = [
    // The moment worked out again shows every feature; kept, those whose watches changed.
    { when: momentChanged, draw: moment.show },
    {
      when: momentKept,
      draw: (state, was) => {
        features.redraw(state, was, moment.terrestrial());
      },
    },
    { when: on(DEEP_TIME), draw: deepTime.show },
    { when: on(SKY_SHOWN), draw: showSky },
    {
      when: onChange(FOCUS),
      draw: (state) => {
        globe.setFocus(state.focus);
      },
    },
    { draw: bodies.render },
    { when: on(EARTH_LAYERS), draw: dates.show },
    { when: on(EARTH_LAYERS), draw: ways.show },
    { when: on(EARTH_LAYERS), draw: rocks.show },
    { when: on(EARTH_LAYERS), draw: namedPeriods.show },
    { when: on(EARTH_LAYERS), draw: showImpacts },
    { when: on(EARTH_LAYERS), draw: carbonMade.show },
    { when: on(LAYERS_PANEL), draw: showLayers },
    { draw: years.settle },
    {
      draw: (state) => {
        zoomRail.render(railView(state));
      },
    },
    { draw: sources.show },
    { draw: texts.show },
    { draw: showBody },
    { draw: bodies.sharpen },
    { draw: asking.render },
    {
      when: on(treeOfLife.watches),
      draw: (state) => {
        treeOfLife.render(state);
      },
    },
    { draw: showSheets },
    // The time changed elsewhere (the year typed, the slider) ends the cycle's play.
    { draw: cycle.render },
    { when: on(HISTORY), draw: years.show },
    {
      when: on(LOCATION),
      draw: (state) => {
        globe.setLocation(state.location);
      },
    },
    {
      when: on(VIEWPOINT),
      draw: (state) => {
        globe.setViewpoint(state.view);
      },
    },
    { when: on(VIEW_SWITCH), draw: showViewSwitch },
    { draw: records.render },
    { draw: eclipses.render },
    {
      draw: (state) => {
        sync.update(state);
      },
    },
    {
      when: onChange(FOUND_THE_WAY_IN),
      draw: () => {
        welcome.dismiss();
      },
    },
  ];
  store.subscribe((state, previous) => {
    drawAll(drawn, state, previous);
  });
  drawAll(drawn, store.get(), null);
  // Write the canonical, fully explicit URL straight away so it can be shared as is.
  sync.flush();

  // Keep the globe centred in the space the panels leave free.
  const top = root.querySelector('.hud');
  if (top !== null) {
    keepCentred({
      root,
      top,
      bottom,
      zoomRail: zoomRail.root,
      onInsets: (above, below) => {
        globe.setInsets(above, below);
        sky.setInsets(above, below);
      },
    });
  }

  // The keyboard, a tap on the globe or around it, a body clicked, the camera moved (#474).
  const input = listenForInput({
    store,
    globe,
    panels,
    openSearch: () => {
      texts.search.open();
    },
    asking: () => asking.on(),
    selected: (state) => eclipses.selected(state),
    sky: { observer: observerOf, aimAt: (state, target) => sky.aimAt(state, target) },
  });
  // A first visit whose link names no view of its own opens over the reader's region.
  openOverRegion({
    search: openedSearch,
    base,
    fetchJson,
    store,
    flyTo: (place) => {
      globe.flyTo(place);
    },
  });
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
