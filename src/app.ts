/**
 * Wires the view state (from the URL) to the globe, the timeline, the scrubber and the card.
 *
 * Browser-only glue, covered by the Playwright suite. Logic worth unit testing lives in the
 * modules it calls.
 */

import { subsolarPoint } from './astro/sun';
import { greatestEclipseUT } from './data/catalog';
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
  defaultViewState,
  momentJulianDay,
  type GeoPoint,
  type ViewState,
} from './state/viewState';
import { DeltaT } from './time/deltaT';
import { formatCalendar, formatDate, formatDuration, formatTimeOfDay } from './time/format';
import { julianDayNumber } from './time/julianDay';
import type { AstronomicalYear } from './time/year';
import { moveToYear } from './time/yearInput';
import { element } from './ui/dom';
import { createEclipseCard } from './ui/eclipseCard';
import { createFamousPanel } from './ui/famousPanel';
import { createScrubber, SCRUB_RANGE_MINUTES } from './ui/scrubber';
import { createTimeline, type Eclipse, type YearEclipses } from './ui/timeline';
import { errorMessage } from './util/errors';

const MINUTES_PER_DAY = 1440;

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

  const globeContainer = element('div', { class: 'globe', 'data-testid': 'globe' });
  const dateText = element('time', { class: 'hud-date' });
  const timeText = element('span', { class: 'hud-time' });
  const detailText = element('p', { class: 'hud-detail' });
  const notices = element('ul', { class: 'notices', role: 'status', 'aria-live': 'polite' });
  const card = createEclipseCard();
  const timeline = createTimeline({
    onYear(year) {
      store.set((state) => ({ ...state, time: moveToYear(state.time, year), selection: null }));
    },
    onSelect(eclipse) {
      flyToSelection = true;
      store.set((state) => ({
        ...state,
        time: eclipseMoment(eclipse),
        selection: eclipseSelection(eclipse),
      }));
    },
  });
  const scrubber = createScrubber((offsetMinutes) => {
    const selected = selectedEclipse(store.get());
    if (selected === undefined) return;
    const jd = greatestEclipseUT(selected) + offsetMinutes / MINUTES_PER_DAY;
    store.set((state) => ({ ...state, time: momentAt(julianDayNumber(jd)) }));
  });

  root.replaceChildren(
    globeContainer,
    element(
      'header',
      { class: 'hud' },
      element('h1', {}, 'histeclipse'),
      element('p', { class: 'hud-when' }, dateText, ' ', timeText),
      detailText,
      famousPanel.button,
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
      ),
    ),
    notices,
    element('div', { class: 'bottom' }, card.root, scrubber.root, timeline.root),
    famousPanel.dialog,
  );

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
    }),
  ]);
  const sync = createUrlSync(browserUrlWriter(window.location, window.history));

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

  // Eclipses of the year on screen. Loads are tagged with their year so a slow response for a
  // year the user already left is ignored.
  let shownYear: AstronomicalYear | null = null;
  let listing: YearEclipses = { status: 'loading' };
  let pathShownFor: SolarEclipse | null = null;

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
    timeline.render({ year: state.time.date.year, eclipses: listing, selected });
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

  function loadYear(state: ViewState): void {
    const year = state.time.date.year;
    if (year === shownYear) return;
    shownYear = year;
    if (!lunarCatalog.covers(year) || !solarCatalog.covers(year)) {
      listing = {
        status: 'error',
        message: `Eclipses are catalogued from ${String(lunarCatalog.index.startYear)} to ${String(lunarCatalog.index.endYear)}`,
      };
      renderSelection(state);
      return;
    }
    listing = { status: 'loading' };
    renderSelection(state);
    Promise.all([lunarCatalog.eclipsesInYear(year), solarCatalog.eclipsesInYear(year)]).then(
      ([lunar, solar]) => {
        if (shownYear !== year) return;
        const eclipses: Eclipse[] = [...lunar, ...solar].sort((a, b) => a.jdTT - b.jdTT);
        listing = { status: 'ready', eclipses };
        renderSelection(store.get());
      },
      (error: unknown) => {
        if (shownYear !== year) return;
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
    root.dataset['subsolar'] = `${sun.latitude.toFixed(3)},${sun.longitude.toFixed(3)}`;
    dateText.textContent = formatDate(state.time);
    timeText.textContent = formatTimeOfDay(state.time);
    const seconds = deltaT.seconds(universal);
    const uncertainty = deltaT.uncertaintySeconds(universal);
    detailText.textContent = `${formatCalendar(state.time)} · ΔT ${formatDuration(seconds)} ± ${formatDuration(uncertainty)}`;
  }

  function render(state: ViewState, previous: ViewState | null): void {
    if (state.time !== previous?.time) showTime(state);
    if (state.time.date.year !== previous?.time.date.year) loadYear(state);
    if (
      state.selection !== previous?.selection ||
      state.layers !== previous.layers ||
      state.location !== previous.location
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
  const bottom = root.querySelector('.bottom');
  if (top !== null && bottom !== null) {
    const update = (): void => {
      const narrow = window.innerWidth <= 600;
      globe.setInsets(
        narrow ? top.getBoundingClientRect().bottom : 0,
        bottom.getBoundingClientRect().height,
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(top);
    observer.observe(bottom);
  }

  globe.onCameraChange((camera) => {
    store.set((state) => ({ ...state, camera }));
  });
  window.addEventListener('pagehide', () => {
    sync.flush();
  });
}
