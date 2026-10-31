/**
 * Wires the view state (from the URL) to the globe, the timeline and the eclipse card.
 *
 * Browser-only glue, covered by the Playwright suite. Logic worth unit testing lives in the
 * modules it calls.
 */

import { subsolarPoint } from './astro/sun';
import { LunarCatalog, greatestEclipseUT, type LunarEclipse } from './data/lunarCatalog';
import { eclipseMoment, eclipseSelection, findSelected } from './eclipses/lunar';
import { longitudeUncertainty, shiftLongitude } from './eclipses/visibility';
import { geoToVector } from './globe/geo';
import { createGlobe } from './globe/scene';
import { createStore } from './state/store';
import { parseViewState } from './state/url';
import { browserUrlWriter, createUrlSync } from './state/urlSync';
import { defaultViewState, momentJulianDay, type ViewState } from './state/viewState';
import { DeltaT } from './time/deltaT';
import { formatCalendar, formatDate, formatDuration, formatTimeOfDay } from './time/format';
import type { AstronomicalYear } from './time/year';
import { moveToYear } from './time/yearInput';
import { element } from './ui/dom';
import { createEclipseCard } from './ui/eclipseCard';
import { createTimeline } from './ui/timeline';
import { errorMessage } from './util/errors';

export async function startApp(root: HTMLElement): Promise<void> {
  const base = import.meta.env.BASE_URL;
  const now = new Date();
  const parsed = parseViewState(window.location.search, now);
  const store = createStore<ViewState>(parsed.state);

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
      // Picking an eclipse also turns the globe toward it; opening a shared link does not,
      // because the link already says where the camera should be.
      flyToSelection = true;
      store.set((state) => ({
        ...state,
        time: eclipseMoment(eclipse),
        selection: eclipseSelection(eclipse),
      }));
    },
  });
  root.replaceChildren(
    globeContainer,
    element(
      'header',
      { class: 'hud' },
      element('h1', {}, 'histeclipse'),
      element('p', { class: 'hud-when' }, dateText, ' ', timeText),
      detailText,
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
    element('div', { class: 'bottom' }, card.root, timeline.root),
  );

  function notify(message: string): void {
    notices.append(element('li', {}, message));
  }
  parsed.warnings.forEach(notify);

  let flyToSelection = false;
  const [deltaT, catalog, globe] = await Promise.all([
    DeltaT.load(`${base}data/delta-t.json`, (url) => fetch(url)),
    LunarCatalog.load(`${base}data/lunar/`, (url) => fetch(url)),
    createGlobe(globeContainer, {
      camera: store.get().camera,
      textureUrl: `${base}textures/earth-blue-marble-2048.jpg`,
    }),
  ]);
  const sync = createUrlSync(browserUrlWriter(window.location, window.history));

  // Eclipses of the year on screen. Loads are tagged with their year so a slow response for a
  // year the user already left is ignored.
  let shownYear: AstronomicalYear | null = null;
  let eclipses: readonly LunarEclipse[] | 'loading' | { readonly error: string } = 'loading';

  function selectedEclipse(state: ViewState): LunarEclipse | undefined {
    return Array.isArray(eclipses) ? findSelected(eclipses, state.selection) : undefined;
  }

  function renderEclipses(state: ViewState): void {
    const selected = selectedEclipse(state);
    timeline.render({ year: state.time.date.year, eclipses, selected });
    const showOverlay = selected !== undefined && state.layers.has('lunar');
    if (selected === undefined || !showOverlay) {
      globe.setLunarOverlay(null);
      card.render(undefined, 0, state.location);
      return;
    }
    const uncertainty = deltaT.uncertaintySeconds(greatestEclipseUT(selected));
    const [latitude, longitude] = selected.sublunar;
    const sublunar = { latitude, longitude };
    if (flyToSelection) {
      flyToSelection = false;
      globe.flyTo(sublunar);
    }
    const shift = longitudeUncertainty(uncertainty);
    globe.setLunarOverlay({
      sublunar: geoToVector(sublunar),
      west: geoToVector(shiftLongitude(sublunar, -shift)),
      east: geoToVector(shiftLongitude(sublunar, shift)),
    });
    card.render(selected, uncertainty, state.location);
  }

  function loadYear(state: ViewState): void {
    const year = state.time.date.year;
    if (year === shownYear) return;
    shownYear = year;
    if (!catalog.covers(year)) {
      eclipses = {
        error: `Eclipses are catalogued from ${String(catalog.index.startYear)} to ${String(catalog.index.endYear)}`,
      };
      renderEclipses(state);
      return;
    }
    eclipses = 'loading';
    renderEclipses(state);
    catalog.eclipsesInYear(year).then(
      (found) => {
        if (shownYear !== year) return;
        eclipses = found;
        renderEclipses(store.get());
      },
      (error: unknown) => {
        if (shownYear !== year) return;
        eclipses = { error: `Could not load eclipses: ${errorMessage(error)}` };
        renderEclipses(store.get());
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
      renderEclipses(state);
    }
    sync.update(state);
  }

  store.subscribe((state, previous) => {
    render(state, previous);
  });
  render(store.get(), null);
  // Write the canonical, fully explicit URL straight away so it can be shared as is.
  sync.flush();

  // Keep the globe centred in the space the bottom panels leave free.
  const bottom = root.querySelector('.bottom');
  if (bottom !== null) {
    new ResizeObserver(() => {
      globe.setBottomInset(bottom.getBoundingClientRect().height);
    }).observe(bottom);
  }

  globe.onCameraChange((camera) => {
    store.set((state) => ({ ...state, camera }));
  });
  window.addEventListener('pagehide', () => {
    sync.flush();
  });
}
