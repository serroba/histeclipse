/**
 * Wires the view state (from the URL) to the globe and the on-screen readout.
 *
 * Browser-only glue, covered by the Playwright suite. Logic worth unit testing lives in the
 * modules it calls.
 */

import { subsolarPoint } from './astro/sun';
import { geoToVector } from './globe/geo';
import { createGlobe } from './globe/scene';
import { parseViewState } from './state/url';
import { browserUrlWriter, createUrlSync } from './state/urlSync';
import { defaultViewState, momentJulianDay, type ViewState } from './state/viewState';
import { DeltaT } from './time/deltaT';
import { formatCalendar, formatDate, formatDuration, formatTimeOfDay } from './time/format';
import { errorMessage } from './util/errors';

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string>> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  node.append(...children);
  return node;
}

export async function startApp(root: HTMLElement): Promise<void> {
  const base = import.meta.env.BASE_URL;
  const now = new Date();
  const parsed = parseViewState(window.location.search, now);
  let state: ViewState = parsed.state;

  const globeContainer = element('div', { class: 'globe', 'data-testid': 'globe' });
  const dateText = element('time', { class: 'hud-date' });
  const timeText = element('span', { class: 'hud-time' });
  const detailText = element('p', { class: 'hud-detail' });
  const notices = element('ul', { class: 'notices', role: 'status', 'aria-live': 'polite' });
  root.replaceChildren(
    globeContainer,
    element(
      'header',
      { class: 'hud' },
      element('h1', {}, 'histeclipse'),
      element('p', { class: 'hud-when' }, dateText, ' ', timeText),
      detailText,
    ),
    notices,
    element(
      'footer',
      { class: 'credits' },
      'Earth imagery: ',
      element(
        'a',
        { href: 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/' },
        'NASA Blue Marble',
      ),
      ' · Positions: JPL DE441',
    ),
  );

  function notify(message: string): void {
    notices.append(element('li', {}, message));
  }
  parsed.warnings.forEach(notify);

  const [deltaT, globe] = await Promise.all([
    DeltaT.load(`${base}data/delta-t.json`, (url) => fetch(url)),
    createGlobe(globeContainer, {
      camera: state.camera,
      textureUrl: `${base}textures/earth-blue-marble-2048.jpg`,
    }),
  ]);

  const sync = createUrlSync(browserUrlWriter(window.location, window.history));

  function showTime(): void {
    const universal = momentJulianDay(state.time);
    let terrestrial;
    try {
      terrestrial = deltaT.terrestrialTime(universal);
    } catch (error) {
      notify(`${errorMessage(error)}. Showing today instead.`);
      state = { ...state, time: defaultViewState(now).time };
      showTime();
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

  showTime();
  // Write the canonical, fully explicit URL straight away so it can be shared as is.
  sync.update(state);
  sync.flush();

  globe.onCameraChange((camera) => {
    state = { ...state, camera };
    sync.update(state);
  });
  window.addEventListener('pagehide', () => {
    sync.flush();
  });
}
