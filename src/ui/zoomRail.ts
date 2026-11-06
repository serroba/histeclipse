/**
 * How far out the view is, on a rail at the side: Earth at the top, out past the Moon to the
 * planets at the bottom, with the stops named so the reader sees that zooming out reaches the
 * Solar System. A stop flies there; the slider and the + and − buttons move along the rail.
 * Below it, a small icon draws the planets' orbits, offered wherever they can be seen.
 *
 * DOM glue, covered by the Playwright suite; the scale and its words are unit-tested.
 */

import { CAMERA_DISTANCE_RANGE } from '../state/viewState';
import { element } from './dom';

export interface ZoomStop {
  /** Distance from Earth's centre, in Earth radii. */
  readonly distance: number;
  readonly label: string;
  readonly title: string;
}

/** The stops, nearest first: what the view takes in from each. */
export const ZOOM_STOPS: readonly ZoomStop[] = [
  { distance: 3, label: 'Earth', title: 'The whole Earth' },
  { distance: 150, label: 'Moon', title: 'Earth and the Moon’s orbit' },
  { distance: 60_000, label: 'Planets', title: 'The inner planets, around the Sun' },
  { distance: 300_000, label: 'Saturn', title: 'Out to Saturn' },
];

const NEAR = Math.log(CAMERA_DISTANCE_RANGE.min);
const FAR = Math.log(CAMERA_DISTANCE_RANGE.max);

/** Where `distance` lies on the rail, from 0 (nearest) to 1 (farthest), by its logarithm. */
export function railPosition(distance: number): number {
  return Math.min(1, Math.max(0, (Math.log(distance) - NEAR) / (FAR - NEAR)));
}

/** The distance at `position` on the rail. */
export function distanceAt(position: number): number {
  return Math.exp(NEAR + Math.min(1, Math.max(0, position)) * (FAR - NEAR));
}

const EARTH_RADIUS_KM = 6371;
const AU_KM = 149_597_870.7;

/** How far from Earth's centre, in words: kilometres nearby, astronomical units far out. */
export function distanceText(distance: number): string {
  const km = distance * EARTH_RADIUS_KM;
  if (km < 10_000_000) {
    const rounded = Number(km.toPrecision(2));
    return `${rounded.toLocaleString('en')} km from Earth`;
  }
  const au = km / AU_KM;
  return `${au < 10 ? au.toFixed(1) : String(Math.round(au))} AU from Earth`;
}

/** How near a stop, as a share of the rail, the slider settles on it. */
const SNAP = 0.06;

/** The distance at `position`, settled on a stop when it is that near one. */
export function snappedDistance(position: number): number {
  const near = ZOOM_STOPS.find((stop) => Math.abs(railPosition(stop.distance) - position) < SNAP);
  return near?.distance ?? distanceAt(position);
}

/** One step of + or −: a sixth of the rail, so six steps go from Earth to Saturn. */
const STEP = 1 / 6;

export interface ZoomRail {
  readonly root: HTMLElement;
  /** The distance shown, in Earth radii; null hides the zoom, leaving the orbits icon. */
  render(distance: number | null): void;
  /** Whether the orbits icon is offered, and on. */
  setOrbits(offered: boolean, on: boolean): void;
}

/** An orbit around a sun, as a small line icon. */
function orbitsIcon(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  const orbit = document.createElementNS(ns, 'ellipse');
  for (const [name, value] of [
    ['cx', '12'],
    ['cy', '12'],
    ['rx', '10'],
    ['ry', '5'],
    ['transform', 'rotate(-20 12 12)'],
    ['fill', 'none'],
    ['stroke', 'currentColor'],
    ['stroke-width', '1.6'],
  ] as const) {
    orbit.setAttribute(name, value);
  }
  const sun = document.createElementNS(ns, 'circle');
  for (const [name, value] of [
    ['cx', '12'],
    ['cy', '12'],
    ['r', '2.6'],
    ['fill', 'currentColor'],
  ] as const) {
    sun.setAttribute(name, value);
  }
  const planet = document.createElementNS(ns, 'circle');
  for (const [name, value] of [
    ['cx', '20.6'],
    ['cy', '8.6'],
    ['r', '1.8'],
    ['fill', 'currentColor'],
  ] as const) {
    planet.setAttribute(name, value);
  }
  svg.append(orbit, sun, planet);
  return svg;
}

export function createZoomRail(handlers: {
  /** Glide to a distance, in Earth radii. */
  onZoom(distance: number): void;
  /** Turn the planets' orbits on or off. */
  onOrbits(): void;
}): ZoomRail {
  let shown: number = ZOOM_STOPS[0]?.distance ?? 3;
  const zoomIn = element(
    'button',
    { type: 'button', class: 'zoom-step', 'aria-label': 'Zoom in' },
    '+',
  );
  const zoomOut = element(
    'button',
    { type: 'button', class: 'zoom-step', 'aria-label': 'Zoom out' },
    '−',
  );
  const slider = element('input', {
    type: 'range',
    class: 'zoom-slider',
    min: '0',
    max: '1000',
    step: '1',
    'aria-label': 'Distance',
    'aria-orientation': 'vertical',
  });
  const stops = ZOOM_STOPS.map((stop) => {
    const button = element(
      'button',
      {
        type: 'button',
        class: 'zoom-stop',
        title: stop.title,
        'aria-label': `Zoom to ${stop.title}`,
      },
      stop.label,
    );
    button.style.top = `${String(railPosition(stop.distance) * 100)}%`;
    button.addEventListener('click', () => {
      handlers.onZoom(stop.distance);
    });
    return button;
  });
  const readout = element('span', { class: 'zoom-readout', 'data-testid': 'zoom-readout' });
  const orbits = element('button', {
    type: 'button',
    class: 'zoom-step zoom-orbits',
    'aria-label': 'Orbits',
    'aria-pressed': 'false',
    title: 'The planets’ orbits round the Sun',
    hidden: '',
  });
  orbits.append(orbitsIcon());
  orbits.addEventListener('click', () => {
    handlers.onOrbits();
  });
  const zoom = element(
    'div',
    { class: 'zoom-parts' },
    zoomIn,
    element('div', { class: 'zoom-track' }, slider, ...stops),
    zoomOut,
  );
  const root = element(
    'div',
    { class: 'zoom-rail', role: 'group', 'aria-label': 'Zoom', hidden: '' },
    zoom,
    orbits,
    readout,
  );
  let zooming = false;
  // Shown while either part has something to offer.
  function sync(): void {
    zoom.hidden = !zooming;
    readout.hidden = !zooming;
    root.hidden = !zooming && orbits.hidden;
  }
  zoomIn.addEventListener('click', () => {
    handlers.onZoom(distanceAt(railPosition(shown) - STEP));
  });
  zoomOut.addEventListener('click', () => {
    handlers.onZoom(distanceAt(railPosition(shown) + STEP));
  });
  slider.addEventListener('input', () => {
    handlers.onZoom(snappedDistance(Number(slider.value) / 1000));
  });
  return {
    root,
    setOrbits(offered, on) {
      orbits.hidden = !offered;
      orbits.setAttribute('aria-pressed', String(on));
      sync();
    },
    render(distance) {
      zooming = distance !== null;
      sync();
      if (distance === null) return;
      shown = distance;
      if (document.activeElement !== slider) {
        slider.value = String(Math.round(railPosition(distance) * 1000));
      }
      const words = distanceText(distance);
      slider.setAttribute('aria-valuetext', words);
      readout.textContent = words.replace(' from Earth', '');
      // The stop the view is at, or has passed on the way out.
      const reached = ZOOM_STOPS.filter((stop) => distance >= stop.distance * 0.7).at(-1);
      for (const [index, stop] of ZOOM_STOPS.entries()) {
        stops[index]?.setAttribute('aria-pressed', String(stop === reached));
      }
    },
  };
}
