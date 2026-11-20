/** The page's wiring (#442): builds each part and lends it what it needs; e2e covers it. */

import { retryingFetch } from './util/fetchJson';
import { LunarCatalog } from './data/lunarCatalog';
import { SolarCatalog } from './data/solarCatalog';
import { createDatingCard } from './ui/datingCard';
import { focusOf } from './globe/focus';
import { createGlobe } from './globe/scene';
import { loadImpacts } from './data/impacts';
import {
  DEEP_TIME,
  drawAll,
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
import { parseViewState } from './state/url';
import { createRedrawRequests } from './state/redrawRequests';
import { browserUrlWriter, createUrlSync } from './state/urlSync';
import { awayFromEarth, toggledLayer, withLayer, type ViewState } from './state/viewState';
import { DeltaT } from './time/deltaT';
import { element } from './ui/dom';
import { layOutPage } from './ui/pageLayout';
import { FEATURES } from './features';
import { deepChipsOf, mountFeatures } from './features/mounted';
import type { Capabilities, FeatureCore } from './features/feature';
import { arrivalSearch } from './explore/destinations';
import { viewOpener } from './explore/open';
import { createWelcome } from './ui/welcome';
import { createMarkerCard } from './ui/markerCard';
import { createViewSwitch } from './ui/viewSwitch';
import { countryRings, loadNamedPeriods } from './data/namedPeriods';
import { createWhySheet } from './ui/whySheet';
import { createImpactPathsSheet } from './ui/impactPathsSheet';
import { lateDeltaT, lateEphemerides, lateTimeline, type PartContext } from './features/part';
import { mountBoundaries } from './features/boundaries';
import { mountTreeOfLife } from './features/treeOfLife';
import { mountSky } from './features/sky';
import { mountBodies } from './features/bodies';
import { mountRecords } from './features/records';
import { mountCycle } from './features/cycle';
import { mountTimeBars } from './features/timeBars';
import { mountFamous } from './features/famous';
import { mountShower } from './features/shower';
import { mountWave } from './features/ligo';
import { mountTelescopeList } from './features/telescopes';
import { createHoloceneNote } from './features/iceAges';
import { createCo2ArchiveFile, createPlateMasks } from './features/deepSurfaces';
import { createBorderFiles, createStatesNote } from './features/empires';
import { mountDeepTime } from './features/deepTime';
import { mountYears } from './features/years';
import { ECLIPSE_EARTH_PARTS, mountEclipses } from './features/eclipses';
import { mountTexts } from './features/texts';
import {
  createAsking,
  createSourcesList,
  hereVersion,
  hereView,
  whyMoment,
  whyVersion,
  type HereData,
} from './features/whyHere';
import { mountMoment } from './features/moment';
import { mountLayersPanel } from './features/layersPanel';
import { mountExplore } from './features/explore';
import {
  createNotices,
  createPanels,
  followHistory,
  keepCentred,
  listenForInput,
  openOverRegion,
} from './features/shell';
import { bodiesSeen, namedPlace, observerOf, placeName } from './features/moment';
import { createZoomRail } from './ui/zoomRail';
import { railView } from './ui/railView';
import { createWaysLegend } from './ui/waysLegend';

export async function startApp(root: HTMLElement): Promise<void> {
  const base = import.meta.env.BASE_URL;
  const now = new Date();
  // The link as the reader opened it (a destination's, its view), before the view is written back.
  const openedSearch = arrivalSearch(window.location.search);
  const parsed = parseViewState(openedSearch, now);
  const store = createStore<ViewState>(parsed.state);
  // Parts ask each other to redraw by name, answered once each is mounted (#606).
  const redraws = createRedrawRequests(store);
  // A server error is asked once more, past the browser's copy of it.
  const fetchJson = retryingFetch((url, init) => fetch(url, init));
  // Full view: the panels hidden for a clear view, and the ways to bring them back.
  const panels = createPanels(root);
  // What went wrong, told once each.
  const notices = createNotices();
  const { notify } = notices;

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
  // Time's playing, kept by the years and deep time and asked of by the parts (#606).
  const time = lateTimeline(540);
  // The Moon's and the planets' theories, kept by the bodies and asked of by the parts (#606).
  const ephemerides = lateEphemerides();
  // ΔT, loaded with the catalogues before anything is drawn (#606).
  const clock = lateDeltaT();
  // What the app lends the parts of the page (#443).
  const partContext: PartContext = {
    base,
    fetchJson,
    store,
    notify,
    timeline: time.timeline,
    ephemerides: ephemerides.ephemerides,
    deltaT: clock.deltaT,
    why: (id, label) => whySheet.mark(id, label),
    goToDeepTime(ma, layer, where) {
      deepTime.enterDeepTime(ma, 'all');
      // The layer on to mark it, and the globe turned to face it where it lay then.
      store.set((state) => ({ ...state, layers: withLayer(state.layers, layer, true) }));
      globe.flyTo(where);
    },
  };
  // The tree of life and life through time: their sheets, and the ways to open them.
  const treeOfLife = mountTreeOfLife(partContext);
  // The sky view (#448): loaded the first time it is opened.
  const sky = mountSky({
    ...partContext,
    bodiesSeen: (state) =>
      bodiesSeen(state, (jd) => clock.deltaT().terrestrialTime(jd), bodies.moon()),
    namedPlace,
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
        loadImpacts(`${base}data/impacts.json`, fetchJson),
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
    step: () => {
      sync.step();
    },
    goToSpan: (span) => {
      deepTime.goToSpan(span);
    },
    enterDeepTime: (ma, scale) => {
      deepTime.enterDeepTime(ma, scale);
    },
    setScale: (scale) => {
      deepTime.setScale(scale);
    },
    said: () => features.said(),
    // How each layer's load stands (#751): the features on the contract report theirs.
    loads: () => features.loads(),
    actions: () => [
      // The features on the contract offer their own (#909).
      ...features.actions(),
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
      store.set((state) => toggledLayer(state, 'orbits'));
    },
    onSpacecraft() {
      store.set((state) => toggledLayer(state, 'spacecraft'));
    },
    onAsteroids() {
      store.set((state) => toggledLayer(state, 'asteroids'));
    },
    onEarth() {
      store.set((state) => ({ ...state, focus: 'earth', on: null, view: 'free' }));
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
    focus: focusOf(store.get()),
    // The features' parts of the Earth shader (#379).
    earthParts: ECLIPSE_EARTH_PARTS,
  });
  // The planetary boundaries' story (#434), and the globe that follows its chart (#475).
  const boundaries = mountBoundaries({ ...partContext, globe });
  // Deep time (#445): its span and moment, playing through it, its bar and glance, Earth's
  // surface from the elevation maps and magnetic north.
  // Two files deep time itself asks about, shared with the plates' and the air's features.
  const plateMasks = createPlateMasks(base, fetchJson);
  const co2Archive = createCo2ArchiveFile(base, fetchJson, {
    notify,
    arrived: redraws.ask('deepTime'),
  });

  const deepTime = mountDeepTime({
    ...partContext,
    globe,
    chips: deepChipsOf(FEATURES),
    step: () => {
      sync.step();
    },
    marked: (on) => {
      bottom.dataset['deep'] = on ? 'on' : 'off';
    },
    header: (ma, story) => {
      moment.deepHeader(ma, story);
    },
    storyDate: boundaries.storyDate,
    bar: (state, moment) => {
      const chips = features.deep(state, moment);
      return { ...features.deepBar(state, moment), chips };
    },
    off: (state) => {
      features.deepOff(state);
    },
    platesReach: () => plateMasks.reach(),
    loadArchive: () => {
      co2Archive.load();
    },
  });
  // A passage's or a destination's view laid over the reader's, as a step back can undo.
  const opener = viewOpener({ store, deepTime, sync: () => sync, globe });
  const openAnchor = opener.anchor;
  // A tablet's records checked against the sky, and looked at from Babylon (#447).
  const records = mountRecords({
    ...partContext,
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
    refresh: redraws.ask('moment'),
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
    explore.button.click();
  });
  // The panels hide for a clear view, by this button or a tap on empty space; it brings them back.
  // The site's texts (#391, #392): search, and what is written about here.
  const texts = mountTexts({
    ...partContext,
    openAnchor,
  });
  // Explore (#727): destinations by topic, opened as the texts' anchors are.
  const explore = mountExplore({
    opener,
    search: texts.search,
    famous: famous.button,
    tree: treeOfLife,
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
  // A gravitational wave passing (#829): space stretched and squeezed, over the globe.
  const wave = mountWave({ ...partContext, globe, showCard: markerCard.show });
  const telescopeList = mountTelescopeList({ ...partContext, showCard: markerCard.show });
  // Cliopatria's border files, shared by the states' layer and the eclipses; and what the years'
  // track last said of the states (nothing until they change).
  const borderFiles = createBorderFiles(base, fetchJson);
  const statesNote = createStatesNote(redraws.ask('years'));
  const holoceneNote = createHoloceneNote(redraws.ask('years'));
  // The years (#446): the track, playing them, travelling through them, and carbon-14 in the air.
  const years = mountYears({
    ...partContext,
    globe,
    datingCard,
    travelChanged: (now) => {
      features.show(now, moment.terrestrial());
      showLayers(now);
      features.deepOff(now);
    },
    statesSaid: () => statesNote.said(),
    holoceneText: () => holoceneNote.said(),
  });
  // Away from Earth and the Moon, the bar's time is the body's own cycle as Earth sees it (#447);
  // with the spacecraft on, it is their launches, the first to today (#702).
  const cycle = mountCycle({
    ...partContext,
    moment: () => moment.terrestrial(),
    history: { ...years.track, stop: years.stop },
  });
  const launches = mountTimeBars({ ...partContext, history: { ...years.track, stop: years.stop } });

  // The borders of past states (#446), a century's file at a time, and what changed.
  // The eclipses (#447): the year's on the bar, picking one, and the moment shown of it.
  const eclipses = mountEclipses({
    ...partContext,
    globe,
    catalogs: () => ({ lunar: lunarCatalog, solar: solarCatalog }),
    famous: () => famous.list(),
    placeName,
    territoryOf: (name, shown) => borderFiles.territoryOf(name, shown),
    centuryFor: (year) => borderFiles.centuryFor(year),
    timelineButtons: [famous.button, records.button],
    timelineExtras: [years.track.extras, cycle.extras, launches.extras],
  });

  // The page's frame (#442): each part's elements, where they go.
  const { hud, hudActions, bottom } = layOutPage(root, {
    under: [
      globeContainer,
      sky.container,
      zoomRail.root,
      ...treeOfLife.elements,
      impactPathsSheet.dialog,
      ...boundaries.elements,
      whySheet.dialog,
    ],
    header: {
      home: base,
      tools: [explore.button, boundaries.button, texts.search.button, panels.fullView],
      date: explore.timeTrigger(moment.dateText),
      time: moment.timeText,
      context: explore.context,
      detail: moment.detailText,
      termNote: moment.termNote,
      welcome: welcome.root,
      actions: [deepTime.spanSwitch, layersPanel.button, layersPanel.chips],
      viewSwitch: viewSwitch.root,
      skyControls: sky.controls,
      bodySwitches: bodies.switches,
      skyCaptions: sky.captions,
      recordsBanner: records.banner,
      sources: sources.list,
      textsHere: texts.here,
    },
    between: [notices.list, deepTime.glance, panels.showControls],
    bottom: {
      eclipseCard: eclipses.card,
      eclipseScrubber: eclipses.scrubber,
      holocene: [
        bodies.bar,
        waysLegend.root,
        years.track.root,
        cycle.root,
        launches.root,
        eclipses.timeline,
      ],
      deepBar: deepTime.bar,
    },
    over: [
      famous.dialog,
      texts.search.dialog,
      records.dialog,
      layersPanel.dialog,
      ...explore.dialogs,
      markerCard.dialog,
      datingCard.dialog,
      shower.container,
      shower.stage,
      ...wave.elements,
      ...telescopeList.elements,
    ],
  });

  parsed.warnings.forEach(notify);

  // Drawn on the globe as layers of their own (#379).
  // The features on the contract (#380): mounted once, shown with each moment, picked by kind.
  const featureCore: FeatureCore = {
    base,
    fetchJson,
    globe,
    notify,
    change: (update) => {
      store.set(update);
    },
    refresh: () => {
      const now = store.get();
      moment.show(now);
      if (now.ma !== null) deepTime.show(now);
      showLayers(now);
      showSheets(now);
    },
  };
  // What a feature may ask for by name (#909): each is lent only those in its `needs`.
  const capabilities: Capabilities = {
    cards: { show: markerCard.show, open: () => markerCard.dialog.open },
    anchors: { open: openAnchor },
    ephemerides: ephemerides.ephemerides,
    timeline: time.timeline,
    zoomRail,
    tree: { openLineages: treeOfLife.openLineagesAt, openTree: treeOfLife.openTreeAt },
    settledLand: globe,
    evenLight: globe,
    deepTime: {
      enter: deepTime.enterDeepTime,
      again: redraws.ask('deepTime'),
      goTo: (ma, layer, where) => {
        partContext.goToDeepTime(ma, layer, where);
      },
    },
    strikes: {
      playImpact: (spec) => {
        globe.playImpact(spec);
      },
      flyTo: (place) => {
        globe.flyTo(place);
      },
      zoomTo: (distance) => {
        globe.zoomTo(distance);
      },
      on: globeContainer,
    },
    radiocarbon: { curves: () => years.curves() },
    datingCard,
    carbonGlow: globe,
    shower: { watch: shower.watch },
    overPage: {
      add: (element) => {
        root.append(element);
      },
    },
    stateBorders: borderFiles,
    yearsTrack: statesNote,
    whyHere: {
      again: () => {
        if (store.get().why === 'here') whySheet.show('here', hereVersion(store.get(), hereData()));
      },
    },
    iceAgeEarth: globe,
    temperatureMaps: globe,
    holoceneNote,
    plateOutlines: globe,
    plateMasks,
    co2Archive,
    waysKey: waysLegend,
  };
  const features = mountFeatures(FEATURES, featureCore, capabilities);
  const [deltaT, lunarCatalog, solarCatalog] = await Promise.all([
    DeltaT.load(`${base}data/delta-t.json`, fetchJson),
    LunarCatalog.load(`${base}data/lunar/`, fetchJson),
    SolarCatalog.load(`${base}data/solar/`, fetchJson),
  ]);
  clock.bind(deltaT);
  const sync = createUrlSync(browserUrlWriter(window.location, window.history));

  // The Moon's theory is a separate chunk; until it arrives the space view shows only the Sun.
  bodies.loadMoon();

  // The famous list is a convenience: if it fails to load, everything else still works.
  famous.load();

  // A marker tapped: a feature's, or a crater's.
  globe.onMarkerPick((key) => {
    features.pick(key);
  });

  /** Away from Earth: Earth's own bits rest, and the body in view shows. */
  function showBody(state: ViewState): void {
    const away = awayFromEarth(state);
    bottom.dataset['away'] = String(away);
    cycle.show(state);
    launches.show(state);
    // The Moon keeps the year's eclipses; Earth's other timelines rest there too (#329).
    bottom.dataset['body'] = state.focus;
    hudActions.hidden = away;
    bodies.show(state);
  }

  /** What the layers have loaded, for "Why here?" to read. */
  function hereData(): HereData {
    return {
      features: features.here(store.get()),
    };
  }

  /** The sky, entered or left: the globe makes way for it. */
  function showSky(state: ViewState): void {
    globeContainer.hidden = state.mode === 'sky';
    sky.render(state);
  }

  /** The sheets the view names open: the impacts' paths, the boundaries, and the why. */
  function showSheets(state: ViewState): void {
    impactPathsSheet.show(state.craters, state.ma ?? 0, state.cratersIn);
    boundaries.render(state);
    whySheet.show(state.why, whyVersion(state, hereData));
  }

  /** The views offered: the Moon's own once its theory has arrived. */
  function showViewSwitch(state: ViewState): void {
    viewSwitch.render(state.mode, state.view, bodies.moon() !== null, state.focus);
  }

  /** The Layers panel, and Explore's view of the layers. */
  function showLayers(state: ViewState): void {
    layersPanel.show(state);
    explore.show(state);
  }

  time.bind({ years, deepTime, launches });
  ephemerides.bind(bodies);
  redraws.answer('moment', moment.show);
  redraws.answer('deepTime', deepTime.show);
  redraws.answer('years', years.show);
  redraws.answer('layers', showLayers);

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
        globe.setFocus(focusOf(state));
      },
    },
    { draw: bodies.render },
    { when: on(LAYERS_PANEL), draw: showLayers },
    { draw: years.settle },
    {
      draw: (state) => {
        zoomRail.render(railView(state, globe.tileLimits !== null));
      },
    },
    { draw: sources.show },
    { draw: texts.show },
    { draw: showBody },
    { draw: bodies.sharpen },
    { draw: asking.render },
    { when: on(wave.watches), draw: wave.render },
    { when: on(telescopeList.watches), draw: telescopeList.render },
    { when: on(treeOfLife.watches), draw: treeOfLife.render },
    { draw: showSheets },
    // The time changed elsewhere (the year typed, the slider) ends the cycle's play.
    { draw: cycle.render },
    { draw: launches.render },
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
  keepCentred({
    root,
    top: hud,
    bottom,
    zoomRail: zoomRail.root,
    onInsets: (above, below, left) => {
      globe.setInsets({ top: above, bottom: below, left });
      sky.setInsets(above, below);
    },
  });

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
  followHistory({ window, store, sync, globe });
}
